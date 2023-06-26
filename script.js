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
	keyCombinations = JSON.parse(JSON.stringify(keyComb));
};
// listen for sync storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
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

const exploredNodes = new Set(); // 2ms faster... :P
const isVisible = el => {
	let parent = el;
	while (parent.tagName !== "BODY") {
		const cssRule = window.getComputedStyle(parent);
		if (
			exploredNodes.has(parent) ||
			cssRule.display === "none" ||
			cssRule.visibility === "hidden" ||
			Number(cssRule.opacity) <= 0.1
		) {
			exploredNodes.add(parent);
			return false;
		}
		parent = parent.parentNode;
	}
	return true;
};

let combinationToElement = {};
const getFocusable = () => {
	const keyElMap = {};

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
		keyElMap[key] = e;
		j++;
	}
	return keyElMap;
};

// Toggles the bubbles
const toggleKeys = (toggle = true) => {
	isActive = toggle;
	if (!isActive && !userPrefs?.autoClose && focusController) focusController.abort();
	if (!isActive) return document.querySelectorAll(".ext-bubble").forEach(e => e.remove());
	combinationToElement = getFocusable();
	for (const key in combinationToElement) createBubble(combinationToElement[key], key);
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

const keyCombination = { str: "", size: 0 };
const resetCombination = () => {
	keyCombination.str = "";
	keyCombination.size = 0;
};
const keyCombinationHandler = key => {
	if (!isActive) return resetCombination();

	keyCombination.str += key;
	keyCombination.size++;

	const isMatch =
		(keyCombination.str in combinationToElement && 1) || // Matched lower case
		(keyCombination.str.toUpperCase() in combinationToElement && 2) || // Matched upper case
		(keyCombination.size === 3 && 3) || // No match
		0; // Not yet matched
	switch (isMatch) {
		case 1:
			persistantFocus(combinationToElement[keyCombination.str]);
			break;
		case 2:
			persistantFocus(combinationToElement[keyCombination.str.toUpperCase()]);
			break;
		case 3:
			break;
		case 0:
			return;
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

document.addEventListener("keyup", e => (e.key === "Control" ? resetShortcut() : 0));

let focusController = null;
function persistantFocus(el) {
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
}

function createBubble(el, key) {
	const bubble = document.createElement("div");
	bubble.classList.add("ext-bubble");
	const rect = el.getBoundingClientRect();
	bubble.style.setProperty("--height", rect.height + "px");
	bubble.style.setProperty("--width", rect.width + "px");
	bubble.style.setProperty("--top", rect.y + "px");
	bubble.style.setProperty("--left", rect.x + "px");

	bubble.style.setProperty("--key", `"${key}"`);
	bubble.style.setProperty("--key-length", key.length + "ch");
	bubble.style.setProperty("--key-font-size", 16 + "px");

	if (rect.top < 26) bubble.style.setProperty("--rotate", 180 + "deg"); // rect.top < 16px font size + 0.6rem padding
	document.getElementById("ext-bubble-container").appendChild(bubble);
}

(function injectCSS() {
	// Remove all bubbles when there is url change (and therefor this script reruns)
	// but the bubble are still there
	document.querySelectorAll(".ext-bubble").forEach(e => e.remove());

	let bubbleContainer = document.createElement("div");
	bubbleContainer.id = "ext-bubble-container";
	document.body.appendChild(bubbleContainer);

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
	`;
	document.head.appendChild(style);
})();
