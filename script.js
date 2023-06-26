/*  --------------------------
	Loading from local storage
	--------------------------*/
let executeShortcut = {
	0: { key: "Control", pressed: false },
	1: { key: "Space", pressed: false },
};
let shortcutLength = 2;
let keyCombinations = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];

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
	console.log("reset", JSON.parse(JSON.stringify(executeShortcut)));
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
	}
});
chrome.storage.local.get("shortcut", ({ shortcut }) => {
	setShortcut(shortcut);
});
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
	setKeyCombinations(keyCombinations);
});
/*  ---------------------------
	Focusable element detection
	---------------------------*/
const isInViewport = el => {
	// Also works when the element or its parent is hidden or has display none
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

let combinationToEl = {};
const getFocusable = () => {
	const keyElMap = {};

	const elArr = [...document.querySelectorAll("input, select, a, button, textarea, [tabindex='0']")];
	for (let i = 0, j = 0; i < elArr.length; i++) {
		const e = elArr[i];
		// filter those that are not in the screen or are disabled or hidden
		if (e.tabIndex === -1) continue;
		if ("disabled" in e && e.disabled) continue;
		if (!isInViewport(e)) continue;

		// Map each element to a unique key press of length 1-2 and return the object
		let key = "";
		const l1 = keyCombinations[0].length;
		const l2 = keyCombinations[1].length;
		const l3 = l1 * l2;
		if (j < l3) {
			key = keyCombinations[0][Math.floor(j / l2)] + keyCombinations[1][j % l2];
		} else {
			key =
				keyCombinations[1][Math.floor(j / l3)] +
				keyCombinations[0][Math.floor(j / l2) % l1] +
				keyCombinations[1][Math.floor(j % l2)];
		}
		keyElMap[key] = e;
		j++;
	}
	return keyElMap;
};

// Create function toggleKeys that will create a small bubble next to each focusable element and inside the bubble will be the key
const toggleKeys = (toggle = true) => {
	if (!toggle) return document.querySelectorAll(".ext-bubble").forEach(e => e.remove());
	combinationToEl = getFocusable();
	for (const key in combinationToEl) createBubble(combinationToEl[key], key);
};

/*  ------------------
	Key event handlers
	------------------*/
let show = true;
const shortcutHandler = key => {
	let i = 0;
	while (i < shortcutLength - 1 && executeShortcut[i].pressed) i++;

	if (key === executeShortcut[i].key) executeShortcut[i].pressed = true;
	else return resetShortcut();

	if (i === shortcutLength - 1) {
		toggleKeys(show);
		show = !show;
		executeShortcut[shortcutLength - 1].pressed = false;
	}
};

const keyCombination = { str: "", size: 0 };
const keyCombinationHandler = key => {
	if (show) {
		keyCombination.str = "";
		keyCombination.size = 0;
		return;
	}
	keyCombination.str += key;
	keyCombination.size++;
	const isMatch =
		(keyCombination.str in combinationToEl && 1) || (keyCombination.str.toUpperCase() in combinationToEl && 2) || 0;
	if (!isMatch) return;

	if (isMatch === 1) combinationToEl[keyCombination.str].focus();
	else combinationToEl[keyCombination.str.toUpperCase()].focus();

	keyCombination.str = "";
	keyCombination.size = 0;
};

document.addEventListener(
	"keydown",
	e => {
		if (e.repeat) return;
		if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
		const key = e.key === " " ? "Space" : e.key;
		if (!show) e.stopPropagation();
		keyCombinationHandler(key);
		shortcutHandler(key);
	},
	{ capture: true }
);

document.addEventListener("keyup", e => (e.key === "Control" ? resetShortcut() : 0));

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

	if (rect.top < 26) bubble.style.setProperty("--rotate", 180 + "deg"); // 16px font size + 0.6rem padding
	el.appendChild(bubble);
	void bubble.offsetWidth; // To force reflow
	if (rect.x + rect.x / 2 < bubble.getBoundingClientRect().x)
		console.log("WTF", rect.x, bubble.getBoundingClientRect().x);
}

(function appendStyle() {
	// Append bubble style to each website
	const style = document.createElement("style");
	style.innerHTML = `
	.ext-bubble {
		--rotate: 0deg;
		position: fixed;
		top: var(--top);
		left: var(--left);

		display: grid;
		width: var(--width);
		height: var(--height);

		border: 2px solid pink;
		border-radius: 2px;
		
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
		width: calc(var(--key-length) + 0.6rem) !important;
		height: calc(var(--key-font-size) + 0.6rem) !important;
		padding: 0.3rem;

		border-radius: 3px;
		background: radial-gradient(circle at center, hsla(0,0%, 100%, 0.8), hsla(0,0%, 100%, 0.5));
		backdrop-filter: blur(5px);
		color: hsl(0, 0%, 8%) !important;
		
		font-size: var(--key-font-size);
		font-weight: 400;

		transform-origin: center;
		transform: rotate(var(--rotate));
	}
	`;
	// .ext-bubble::after {
	// 	content: "";
	// 	position: absolute;
	// 	display: grid;
	// 	justify-items: center;
	// 	align-content: center;

	// 	top: calc(-2rem);
	// 	right: 0;
	// 	width: calc(var(--key-length) + 0.6rem) !important;
	// 	height: calc(var(--key-font-size) + 0.6rem) !important;
	// 	padding: 0.3rem;
	// }
	// `;
	document.head.appendChild(style);
})();
