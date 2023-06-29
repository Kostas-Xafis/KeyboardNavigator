/*  --------------------------
	Loading from local storage
	--------------------------*/
let executeShortcut = {
	0: { key: "Control", pressed: false },
	1: { key: "Space", pressed: false },
};
let shortcutLength = 2;
let keyCombinations = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];
let userPrefs = {};
const setShortcut = shortcut => {
	if (shortcut == "" || shortcut == null || shortcut == undefined) return;
	shortcut = shortcut.split("+");
	let newShortcut = {};
	for (let i = 0; i < shortcut.length; i++) {
		newShortcut[i] = {};
		newShortcut[i].key = shortcut[i];
		newShortcut[i].pressed = false;
	}
	executeShortcut = newShortcut;
	shortcutLength = shortcut.length;
};
const resetShortcut = () => {
	for (let i = 0; i < shortcutLength; i++) executeShortcut[i].pressed = false;
};

const setKeyCombinations = keyComb => {
	if (!keyComb || !keyComb?.length) return;
	keyCombinations = keyComb;
};
// listen for sync storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
	for (let [key, { _oldValue, newValue }] of Object.entries(changes)) {
		if (key === "shortcut") setShortcut(newValue);
		else if (key === "keyCombinations") setKeyCombinations(newValue);
		else if (key === "prefs") userPrefs = JSON.parse(JSON.stringify(newValue));
	}
});

chrome.storage.local.get("shortcut", ({ shortcut }) => {
	setShortcut(shortcut);
});
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
	setKeyCombinations(keyCombinations);
});
chrome.storage.local.get("prefs", ({ prefs }) => {
	userPrefs = JSON.parse(JSON.stringify(prefs || {}));
});

/*  ---------------------------
	Focusable element detection
	---------------------------*/
const isInViewport = el => {
	// Also works when the element or it's
	// parent is hidden or has display none
	const rect = el.getBoundingClientRect();
	return (
		rect.height >= 1 &&
		rect.width >= 1 &&
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

const invisibleElements = new Set(); // 4ms faster
const setInvisibleElements = () => {
	Array.from(document.querySelectorAll("body *:not(script, style)")).forEach(e => {
		let cssRule = window.getComputedStyle(e);
		if (cssRule.display[0] === "n" || cssRule.visibility[0] === "h" || Number(cssRule.opacity) <= 0.1)
			invisibleElements.add(e);
		else invisibleElements.delete(e);
	});
};
const isVisible = el => {
	let parent = el;
	while (parent.tagName !== "BODY") {
		if (invisibleElements.has(parent)) return false;
		parent = parent.parentNode;
	}
	return true;
};
const combinationToElement = new Map();
const getFocusable = () => {
	const elArr = [...document.querySelectorAll("input, select, a, button, textarea, [tabindex='0']")];
	for (let i = 0, j = 0; i < elArr.length; i++) {
		const e = elArr[i];
		// filter those that are not tabbable || are disabled || not in the screen
		if (e.tabIndex === -1 || e?.disabled || !isInViewport(e) || !isVisible(e)) continue;

		// Map each element to a unique key press of length 1-2 and return the object
		let key = "";
		const l1 = keyCombinations[0].length;
		const l2 = keyCombinations[1].length;
		const l3 = l1 * l2;
		if (j < l3) {
			key = keyCombinations[0][Math.floor(j / l2)] + keyCombinations[1][j % l2];
		} else {
			let index = Math.floor(j / l3) - 1;
			let comb1 = index - l1 < 0 ? keyCombinations[0][index] : keyCombinations[1][index - l1];
			key = comb1 + keyCombinations[0][Math.floor(j / l2) % l1] + keyCombinations[1][Math.floor(j % l2)];
		}
		combinationToElement.set(key, e);
		j++;
	}
};

const displayBubbles = (combination = "") => {
	// Rerender the bubbles while preserving the focused one
	const focusedElement = document.querySelector(`.ext-bubble-focus`);
	const focusedKey = focusedElement?.getAttribute("data-key");
	console.log({ focusedKey, combination });
	let s = (focusedElement && focusedElement.outerHTML) || "";
	if (combination === "") {
		if (!focusedElement) combinationToElement.forEach((el, key) => (s += createBubble(el, key)));
		else combinationToElement.forEach((el, key) => (s += key !== focusedKey ? createBubble(el, key) : ""));
	} else {
		if (!focusedElement)
			combinationToElement.forEach((el, key) => (s += key.startsWith(combination) ? createBubble(el, key) : ""));
		else
			combinationToElement.forEach(
				(el, key) => (s += key !== focusedKey && key.startsWith(combination) ? createBubble(el, key) : "")
			);
	}

	document.getElementById("ext-bubble-container").innerHTML = s; // another 80% drop in time (~35ms)
};

// Toggles the bubbles
const toggleKeys = (toggle = true) => {
	isActive = toggle;
	if (!isActive && !userPrefs?.autoClose && focusController) focusController.abort();
	if (!isActive) return document.querySelectorAll(".ext-bubble").forEach(e => e.remove());
	getFocusable();
	displayBubbles();
};

/*  ------------------------------
	Key event handlers & listeners
	------------------------------*/
let isActive = false;
const shortcutHandler = key => {
	let i = 0;
	while (i < shortcutLength - 1 && executeShortcut[i].pressed) i++;

	if (key === executeShortcut[i].key) executeShortcut[i].pressed = true;
	else return resetShortcut();

	if (i === shortcutLength - 1) {
		toggleKeys(!isActive);
		executeShortcut[shortcutLength - 1].pressed = false;
	}
};

const keyCombination = { str: "" };
const resetCombination = () => {
	keyCombination.str = "";
};
const keyCombinationHandler = key => {
	if (!isActive) return resetCombination();

	keyCombination.str += key.toUpperCase();

	let isMatching = false;
	for (let [keyComb, el] of combinationToElement) {
		if (keyComb.startsWith(keyCombination.str) && keyCombination.str.length !== keyComb.length) {
			isMatching = true;
			break;
		}
	}
	const isMatch =
		(isMatching && 2) || // Partial match
		(combinationToElement.has(keyCombination.str) && 1) || // Matched
		0; // Not match
	switch (isMatch) {
		case 2:
			displayBubbles(keyCombination.str);
			return;
		case 1:
			persistantFocus(keyCombination.str);
			displayBubbles();
			break;
		case 0:
			displayBubbles();
			break;
	}
	resetCombination();
};

document.addEventListener(
	"keydown",
	e => {
		if (e.key === "Enter" && isActive) return; // To allow enter to be pressed
		if (isActive) e.stopPropagation();
		if (e.repeat) return;
		if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
		const key = e.key === " " ? "Space" : e.key;
		keyCombinationHandler(key);
		shortcutHandler(key);
	},
	{ capture: true }
);

document.addEventListener("keyup", e => (e.key === executeShortcut[0].key ? resetShortcut() : 0));

let focusController = null;
function persistantFocus(key) {
	const el = combinationToElement.get(key);
	// This function is specifacally made for elements in the page that auto focus themselves when a certain key is pressed
	// And probably captures the event after the extension does
	// Thanks for the headache @bing
	if (focusController) focusController.abort();
	focusController = new AbortController();

	el.focus();
	el.addEventListener(
		"blur",
		() => {
			// If the user is not using the extension but has made a selection,
			// allow other elements to be focused after 1 second
			if (!isActive && userPrefs?.autoClose) setTimeout(focusController.abort, 1000);
			el.focus();
		},
		{ signal: focusController.signal }
	);
	if (userPrefs?.autoClose) toggleKeys(false);
	document.querySelector(".ext-bubble-focus")?.classList.remove("ext-bubble-focus");
	document.querySelector(`.ext-bubble[data-key=${key}]`).classList.add("ext-bubble-focus");
}

function createBubble(el, key) {
	const bubble = document.createElement("div");
	bubble.classList.add("ext-bubble");
	const rect = el.getBoundingClientRect();
	const height = rect.height + "px";
	const width = rect.width + "px";
	const top = rect.y + "px";
	const left = rect.x + "px";
	key = `"${key}"`;
	const key_length = key.length + "ch";
	const key_font_size = 16 + "px";
	const rotate = rect.top < 26 ? 180 + "deg" : 0 + "deg";
	return `<div data-key=${key} class="ext-bubble" style='--rotate: ${rotate}; --key: ${key}; --key-length: ${key_length}; --key-font-size: ${key_font_size}; --left: ${left}; --top: ${top}; --width: ${width}; --height: ${height}'></div>`;
}

const injectCSS = () => {
	console.log("Script.js has been executed");
	// Remove all bubbles when there is url change (and therefor this script reruns)
	// but the bubble are still there
	document.getElementById("ext-bubble-container")?.remove();

	let bubbleContainer = document.createElement("div");
	bubbleContainer.id = "ext-bubble-container";

	// Append bubble style to each website
	const style = document.createElement("style");
	style.innerHTML = `
	#ext-bubble-container {
		width:1px;
		height:1px;

		position: fixed;
		z-index: 999999;
	}
	.ext-bubble {
		--rotate: 0deg;
		position: fixed;
		top: var(--top);
		left: var(--left);

		display: grid;
		width: var(--width);
		height: var(--height);

		border: 2px solid hsl(187, 65%, 65%);
		border-radius: 2px;
		
		z-index: 999999;
		transform-origin: center;
		transform: rotate(var(--rotate));
	}
	.ext-bubble::before {
		content: var(--key);
		position: absolute;
		
		display: grid;
		justify-items: center;
		align-content: center;
		
		top: calc(-2rem);
		right: 0;
		width: calc(var(--key-length) * var(--key-font-size) + 0.6rem) !important;
		height: calc(var(--key-font-size) + 0.4rem) !important;
		padding: 0.2rem 0.3rem;

		border-radius: 3px;
		background: radial-gradient(circle at center, hsla(0,0%, 100%, 0.8), hsla(0,0%, 100%, 0.5));
		box-shadow: -1px 1px 2px 1px hsla(0, 0%, 13%, 0.7);
		backdrop-filter: blur(5px);
		color: hsl(0, 0%, 8%) !important;
		
		font-size: var(--key-font-size);
		font-weight: 400;

		transform-origin: center;
		transform: rotate(var(--rotate));
	}
	.ext-bubble-focus {
		border: 2px solid hsl(24, 88%, 55%);
	}
	`;
	document.body.appendChild(bubbleContainer);
	document.body.appendChild(style);
};
injectCSS();

// Might be useless? I'll test it later
let currentURL = window.location.href;
const observer = new MutationObserver(mutations => {
	if (currentURL !== window.location.href) {
		currentURL = window.location.href;
		combinationToElement.clear();
		invisibleElements.clear();
		setInvisibleElements();
		injectCSS();
	}
	// console.log(mutations);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
