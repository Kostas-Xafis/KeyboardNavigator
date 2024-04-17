/*  --------------------------
    Loading from local storage
    --------------------------*/

import { injectCSS } from "./injectCSS";
import { Preferences, Shortcut, UserStorage } from "./types";
import { FocusableElements, InvisibleElements, UpdateHandler } from "./utils";

const userStorage: UserStorage = {
    shortcut: "Control+Space",
    keyCombinations: ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"],
    prefs: {
        autoClose: false,
        primaryColor: "#33e7ff",
        selectionColor: "#f17827",
        fontSize: "16px",
    },
};

let executeShortcut: Shortcut = {
    0: { key: "Control", pressed: false },
    1: { key: "Space", pressed: false },
};
let shortcutLength = 2;
let keyCombinations = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];
let userPrefs = {
    autoClose: false,
    primaryColor: "#33e7ff",
    selectionColor: "#f17827",
    fontSize: "16px",
};

const setPrefs = {
    setShortcut: (shortcut: string) => {
        if (shortcut == "" || shortcut == null || shortcut == undefined) return;
        let newShortcut: Shortcut = {};
        const shortcutKeys = shortcut.split("+");
        for (let i = 0; i < shortcutKeys.length; i++) {
            newShortcut[i] = {} as any;
            newShortcut[i].key = shortcutKeys[i];
            newShortcut[i].pressed = false;
        }
        executeShortcut = newShortcut;
        shortcutLength = Object.keys(newShortcut).length;
    },
    resetShortcut: () => {
        for (let shortcut in executeShortcut) {
            executeShortcut[shortcut].pressed = false;
        }
    },
    keyCombinations: (keyComb: string[]) => {
        if (!keyComb || !keyComb?.length) return;
        keyCombinations = keyComb;
    },
    prefs: (prefs: Preferences) => {
        console.log(prefs);
        if (!prefs || Object.keys(prefs).length === 0) return;
        userPrefs = JSON.parse(JSON.stringify(prefs));
        injectCSS(userPrefs);
    },
};

// listen for sync storage updates
//es-lint-disable-next-line
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (key === "shortcut") setPrefs.setShortcut(newValue);
        else if (key === "keyCombinations") setPrefs.keyCombinations(newValue);
        else if (key === "prefs") setPrefs.prefs(newValue);
    }
    console.log("Changes to storage:", changes);
});

chrome.storage.local.get("shortcut", ({ shortcut }) => setPrefs.setShortcut(shortcut));
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => setPrefs.keyCombinations(keyCombinations));
chrome.storage.local.get("prefs", ({ prefs }) => setPrefs.prefs(prefs));

/*  ---------------------------
    Focusable element detection
    ---------------------------*/
const Invisible = new InvisibleElements();

const Focusable = new FocusableElements();

const displayBubbles = (combination = "") => {
    // Rerender the bubbles while preserving the focused one
    const focusedElement = document.querySelector(`.ext-bubble-focus`);
    const focusedKey = focusedElement?.getAttribute("data-key");
    let s = (focusedElement && focusedElement.outerHTML) || "";
    if (combination === "") {
        if (!focusedElement) Focusable.forEach((el, key) => (s += createBubble(el, key)));
        else Focusable.forEach((el, key) => (s += key !== focusedKey ? createBubble(el, key) : ""));
    } else {
        if (!focusedElement)
            Focusable.forEach((el, key) => (s += key.startsWith(combination) ? createBubble(el, key) : ""));
        else
            Focusable.forEach(
                (el, key) => (s += key !== focusedKey && key.startsWith(combination) ? createBubble(el, key) : "")
            );
    }

    (document.getElementById("ext-bubble-container")!).innerHTML = s; // another 80% drop in time (~35ms)
};

const updateState = () => {
    const focusedElement = document.querySelector(`.ext-bubble-focus`);
    const focusedKey = focusedElement?.getAttribute("data-key");
    Invisible.setElements();
    if (focusedKey && Focusable.get(focusedKey)) focusedElement?.classList.remove("ext-bubble-focus");
    Focusable.setFocusable(keyCombinations, Invisible);
};

// Toggles the bubbles
const toggleState = (toggle = true) => {
    isActive = toggle;
    if (!isActive) {
        if (!userPrefs.autoClose && focusController) focusController.abort();
        return ((document.getElementById("ext-bubble-container")!).innerHTML = "");
    }
    Focusable.setFocusable(keyCombinations, Invisible);
    displayBubbles();
};

/*  ------------------------------
    Key event handlers & listeners
    ------------------------------*/
let isActive = false;
const shortcutHandler = (key: string) => {
    let i = 0;
    while (i < shortcutLength - 1 && executeShortcut[i].pressed) i++;

    if (key === executeShortcut[i].key) executeShortcut[i].pressed = true;
    else return setPrefs.resetShortcut();

    if (i === shortcutLength - 1) {
        if (!isActive) persistentFocus();
        toggleState(!isActive);
        executeShortcut[shortcutLength - 1].pressed = false;
    }
};

const keyCombination = { str: "" };
const resetCombination = () => {
    keyCombination.str = "";
};
const keyCombinationHandler = (key: string) => {
    if (!isActive) return resetCombination();

    keyCombination.str += key.toUpperCase();

    let isMatching = false;
    for (let keyComb of Focusable.keys()) {
        if (keyComb.startsWith(keyCombination.str) && keyCombination.str.length !== keyComb.length) {
            isMatching = true;
            break;
        }
    }
    const isMatch =
        (isMatching && 2) || // Partial match
        (Focusable.has(keyCombination.str) && 1) || // Matched
        0; // Not match
    switch (isMatch) {
        case 2:
            displayBubbles(keyCombination.str);
            return;
        case 1:
            persistentFocus(keyCombination.str);
            displayBubbles();
            break;
        case 0:
            displayBubbles();
            break;
    }
    resetCombination();
};
const preservedKeyCodes = new Set([
    "Enter",
    "ArrowLeft",
    "ArrowUp",
    "ArrowRight",
    "ArrowDown",
    "PrintScreen",
    "Insert",
    "Delete",
    "Meta",
    "Backspace",
]);
document.addEventListener(
    "keydown",
    e => {
        if (preservedKeyCodes.has(e.key)) return;
        if (isActive && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.repeat) return;
        const key = e.key === " " ? "Space" : e.key;
        keyCombinationHandler(key);
        shortcutHandler(key);
    },
    { capture: true }
);

document.addEventListener("keyup", e => (e.key === executeShortcut[0].key ? setPrefs.resetShortcut() : 0));

document.addEventListener("scroll", () => {
    if (!isActive) return;
    toggleState(false);
});

document.addEventListener("domUpdateComplete", () => {
    if (!isActive) return;
    displayBubbles();
});

let focusController: AbortController | null = null;
function persistentFocus(key = "") {
    const el = key !== "" ? Focusable.get(key) : document.getElementById(`ext-bubble-container`);
    // This function is specifacally made for elements in the page that auto focus themselves when a certain key is pressed
    // And probably captures the event after the extension does
    // Thanks for the headache @bing
    if (focusController) focusController.abort();
    if (!el) return;
    focusController = new AbortController();

    // el.setAttribute("tabindex", "-1");
    el.focus();
    // Once the user has clicked on the element, update the focusable elements
    el.addEventListener(
        "blur",
        () => {
            // If the user is not using the extension but has made a selection,
            // allow other elements to be focused after 1 second
            if (!isActive && userPrefs.autoClose && focusController !== null) setTimeout(focusController.abort, 1000);
            el.focus();
            // el.setAttribute("tabindex", "0");
        },
        { signal: focusController.signal }
    );
    if (key) {
        if (userPrefs.autoClose) toggleState(false);
        document.querySelector(".ext-bubble-focus")?.classList.remove("ext-bubble-focus");
        document.querySelector(`.ext-bubble[data-key=${key}]`)?.classList.add("ext-bubble-focus");
    }
}

function createBubble(el: HTMLElement, key: string) {
    const bubble = document.createElement("div");
    bubble.classList.add("ext-bubble");
    const rect = el.getBoundingClientRect();
    const height = rect.height + "px";
    const width = rect.width + "px";
    const top = rect.y + "px";
    const left = rect.x + "px";
    key = `"${key}"`;
    const key_length = key.length + "ch";
    const rotate = rect.top < 26 ? 180 + "deg" : 0 + "deg";
    return `<div data-key=${key} class="ext-bubble" style='--rotate: ${rotate}; --key: ${key}; --key-length: ${key_length}; --left: ${left}; --top: ${top}; --width: ${width}; --height: ${height}'></div>`;
}

class DomUpdateListener {
    startTime = 0;
    timeThreshold = 500;
    currentURL = window.location.href;

    observer = new MutationObserver(mutations => {
        if (this.startTime === 0) {
            if (mutations.findIndex(mutation => (mutation.target as Element).id === "ext-bubble-container") !== -1) return;
            this.startTime = Date.now();
            this.updateHandler.timeout().catch(() => { }); // Using catch to stop the error from being thrown into the extensions tab
        } else if (Date.now() - this.startTime < this.timeThreshold) {
            this.updateHandler.reset().catch(() => { });
        }
    });
    updateHandler = new UpdateHandler(this.timeThreshold, () => {
        this.startTime = 0;
        updateState();
        if (this.currentURL !== window.location.href) {
            this.currentURL = window.location.href;
            toggleState(false);
        }
        document.dispatchEvent(new Event("domUpdateComplete"));
    });
    constructor() {
        this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    static createInstace() {
        let instance = new DomUpdateListener();
    }
}

DomUpdateListener.createInstace(); // Initial instance to capture the final dom tree and update the focusable and invisible elements accordingly
injectCSS(userPrefs);