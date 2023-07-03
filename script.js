/*  --------------------------
	Loading from local storage
	--------------------------*/

let executeShortcut = {
	0: { key: "Control", pressed: false },
	1: { key: "Space", pressed: false },
};
let shortcutLength = 2;
let keyCombinations = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];
let userPrefs = {
	autoClose: false,
	baseColor: "#6cd2e0",
	selectionColor: "#f17827",
};
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
const setUserPrefs = prefs => {
	if (!prefs || Object.keys(prefs).length === 0) return;
	userPrefs = prefs;
	injectCSS();
};
// listen for sync storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
	for (let [key, { _oldValue, newValue }] of Object.entries(changes)) {
		if (key === "shortcut") setShortcut(newValue);
		else if (key === "keyCombinations") setKeyCombinations(newValue);
		else if (key === "prefs") setUserPrefs(newValue);
	}
});

chrome.storage.local.get("shortcut", ({ shortcut }) => {
	setShortcut(shortcut);
});
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
	setKeyCombinations(keyCombinations);
});
chrome.storage.local.get("prefs", ({ prefs }) => {
	setUserPrefs(prefs);
});

/*  ---------------------------
	Focusable element detection
	---------------------------*/
class InvisibleElements {
	elements = new Set(); // 4ms faster

	constructor() {}
	setElements(clear = false) {
		this.elements.clear();
		let recentParent = null; // 50% faster update & 10% faster display due size reduction
		document.querySelectorAll("body *:not(script, style)").forEach(e => {
			if (recentParent !== e.previousSibling) return;
			let cssRule = window.getComputedStyle(e);
			if (cssRule.display[0] === "n" || cssRule.visibility[0] === "h" || Number(cssRule.opacity) <= 0.1) {
				this.elements.add(e);
			} else this.elements.delete(e);
		});
	}
	has = el => this.elements.has(el);
	isVisible = el => {
		let parent = el;
		while (parent.tagName !== "BODY") {
			if (this.elements.has(parent)) return false;
			parent = parent.parentNode;
		}
		return true;
	};
}
const invisible = new InvisibleElements();

class FocusableElements {
	elements = new Map();

	isInViewport = el => {
		// Also works when the element or it's
		// parent is hidden or has display none
		const rect = el.getBoundingClientRect();
		return (
			rect.width >= 1 &&
			rect.height >= 1 &&
			rect.top >= 0 &&
			rect.left >= 0 &&
			rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
			rect.right <= (window.innerWidth || document.documentElement.clientWidth)
		);
	};

	setFocusable = () => {
		this.elements.clear();
		const elArr = [
			...document.querySelectorAll(
				"input, select, a, button, textarea, [tabindex='0']:not(#ext-bubble-container)"
			),
		];
		for (let i = 0, j = 0; i < elArr.length; i++) {
			const e = elArr[i];
			// filter those that are not tabbable || are disabled || not in the screen
			if (e.tabIndex === -1 || e?.disabled || !this.isInViewport(e) || !invisible.isVisible(e)) continue;

			// Map each element to a unique key press of length 2-3 and return the object
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
			this.elements.set(key, e);
			j++;
		}
	};
	get = key => this.elements.get(key);
	has = key => this.elements.has(key);
	keys = () => this.elements.keys();
	forEach = callback => this.elements.forEach(callback, this);
}
const focusable = new FocusableElements();

const displayBubbles = (combination = "") => {
	// Rerender the bubbles while preserving the focused one
	const focusedElement = document.querySelector(`.ext-bubble-focus`);
	const focusedKey = focusedElement?.getAttribute("data-key");
	let s = (focusedElement && focusedElement.outerHTML) || "";
	if (combination === "") {
		if (!focusedElement) focusable.forEach((el, key) => (s += createBubble(el, key)));
		else focusable.forEach((el, key) => (s += key !== focusedKey ? createBubble(el, key) : ""));
	} else {
		if (!focusedElement)
			focusable.forEach((el, key) => (s += key.startsWith(combination) ? createBubble(el, key) : ""));
		else
			focusable.forEach(
				(el, key) => (s += key !== focusedKey && key.startsWith(combination) ? createBubble(el, key) : "")
			);
	}

	document.getElementById("ext-bubble-container").innerHTML = s; // another 80% drop in time (~35ms)
};

const updateState = () => {
	const focusedElement = document.querySelector(`.ext-bubble-focus`);
	const focusedKey = focusedElement?.getAttribute("data-key");
	invisible.setElements();
	if (focusable.get(focusedKey)) focusedElement.classList.remove("ext-bubble-focus");
	focusable.setFocusable();
};

// Toggles the bubbles
const toggleState = (toggle = true) => {
	isActive = toggle;
	if (!isActive) {
		if (!userPrefs.autoClose && focusController) focusController.abort();
		return (document.getElementById("ext-bubble-container").innerHTML = "");
	}
	focusable.setFocusable();
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
		if (!isActive) persistantFocus();
		toggleState(!isActive);
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
	for (let keyComb of focusable.keys()) {
		if (keyComb.startsWith(keyCombination.str) && keyCombination.str.length !== keyComb.length) {
			isMatching = true;
			break;
		}
	}
	const isMatch =
		(isMatching && 2) || // Partial match
		(focusable.has(keyCombination.str) && 1) || // Matched
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

document.addEventListener("keyup", e => (e.key === executeShortcut[0].key ? resetShortcut() : 0));

document.addEventListener("scroll", () => {
	if (!isActive) return;
	toggleState(false);
});

document.addEventListener("domUpdateComplete", () => {
	if (!isActive) return;
	displayBubbles();
});

let focusController = null;
function persistantFocus(key = "") {
	const el = key !== "" ? focusable.get(key) : document.getElementById(`ext-bubble-container`);
	// This function is specifacally made for elements in the page that auto focus themselves when a certain key is pressed
	// And probably captures the event after the extension does
	// Thanks for the headache @bing
	if (focusController) focusController.abort();
	focusController = new AbortController();

	el.focus();
	// Once the user has clicked on the element, update the focusable elements
	el.addEventListener(
		"blur",
		() => {
			// If the user is not using the extension but has made a selection,
			// allow other elements to be focused after 1 second
			if (!isActive && userPrefs.autoClose) setTimeout(focusController.abort, 1000);
			el.focus();
		},
		{ signal: focusController.signal }
	);
	if (key) {
		if (userPrefs.autoClose) toggleState(false);
		document.querySelector(".ext-bubble-focus")?.classList.remove("ext-bubble-focus");
		document.querySelector(`.ext-bubble[data-key=${key}]`).classList.add("ext-bubble-focus");
	}
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

class DomUpdateListener {
	startTime = 0;
	timeThreshold = 500;
	currentURL = window.location.href;

	observer = new MutationObserver(mutations => {
		if (this.startTime === 0) {
			if (mutations.findIndex(mutation => mutation.target.id === "ext-bubble-container") !== -1) return;
			this.startTime = Date.now();
			this.updateHandler.timeout().catch(() => {}); // Using catch to stop the error from being thrown into the extensions tab
		} else if (Date.now() - this.startTime < this.timeThreshold) {
			this.updateHandler.reset().catch(() => {});
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

// A class that can set an abortable timeout that can be reset
class UpdateHandler {
	abortController = new AbortController();
	timeoutFired = false;
	func = () => {};
	timer = 0;
	timeout = (ms = 0) => {
		this.timeoutFired = true;
		return new Promise((res, rej) => {
			let tId = setTimeout(() => {
				this.timeoutFired = false;
				this.func.call();
				res(null);
			}, ms || this.timer);
			this.abortController.signal.onabort = () => {
				clearTimeout(tId);
				this.abortController = new AbortController();
				rej(null);
			};
		});
	};
	abort = () => {
		if (this.timeoutFired) this.abortController.abort();
		this.timeoutFired = false;
	};
	reset(ms = 0) {
		this.abort();
		return this.timeout(ms || this.timer);
	}
	constructor(timer = 0, func = () => {}) {
		this.timer = timer;
		this.func = func;
	}
}

DomUpdateListener.createInstace(); // Initial instance to capture the final dom tree and update the focusable and invisible elements accordingly

const injectCSS = () => {
	// Remove all bubbles when there is url change (and therefor this script reruns)
	// but the bubble are still there
	const container = document.getElementById("ext-bubble-container");
	let innerHTML = "";
	if (container) {
		innerHTML = container.innerHTML;
		container.remove();
		document.getElementById("ext-bubble-style")?.remove();
	}

	let bubbleContainer = document.createElement("div");
	bubbleContainer.id = "ext-bubble-container";
	bubbleContainer.tabIndex = 0;
	bubbleContainer.innerHTML = innerHTML;
	// Append bubble style to each website
	const style = document.createElement("style");
	style.id = "ext-bubble-style";
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

		border: 2px solid ${userPrefs.baseColor};
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
		border: 3px solid ${userPrefs.selectionColor};
	}
	`;
	document.body.appendChild(bubbleContainer);
	document.body.appendChild(style);
};
injectCSS();
