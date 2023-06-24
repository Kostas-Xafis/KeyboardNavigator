/*  --------------------------
	Loading from local storage
	--------------------------*/
let executeShortcut = {
	0: { key: "Control", pressed: false },
	1: { key: "Space", pressed: false }
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
	const rect = el.getBoundingClientRect();
	return (
		rect.top >= rect.height / 2 &&
		rect.left >= 0 &&
		rect.height > 0 &&
		rect.width > 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

let combinationToEl = {};
const getFocusable = () => {
	const keyElMap = {};
	[...document.querySelectorAll("input, select, a, button, textarea, [tabindex='0']")]
		// filter those that are not in the screen or are disabled or hidden
		.filter(e => {
			if (e.tabIndex === -1) return false;
			if ("disabled" in e && e.disabled) return false;
			// check if any parent is hidden or with display none
			let parent = e;
			while (parent.tagName !== "BODY") {
				if (parent.style.display === "none" || parent.hidden) return false;
				parent = parent.parentElement;
			}
			return isInViewport(e);
		})
		// Map each element to a unique key press of length 1-2 and return the object
		.forEach((e, i) => {
			let key = "";
			const l1 = keyCombinations[0].length;
			const l2 = keyCombinations[1].length;
			const l3 = l1 * l2;
			if (i < l3) {
				key = keyCombinations[0][Math.floor(i / l2)] + keyCombinations[1][i % l2];
			} else {
				key =
					keyCombinations[1][Math.floor(i / l3)] +
					keyCombinations[0][Math.floor(i / l2) % l1] +
					keyCombinations[1][Math.floor(i % l2)];
			}
			keyElMap[key] = e;
		});
	return keyElMap;
};

// Create function toggleKeys that will create a small bubble next to each focusable element and inside the bubble will be the key
const toggleKeys = (toggle = true) => {
	if (!toggle) return document.querySelectorAll(".ext-bubble").forEach(e => e.remove());
	combinationToEl = getFocusable();
	for (const key in combinationToEl) {
		createBubble(combinationToEl[key], key);
	}
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
	if (!(keyCombination.str in combinationToEl) && !(keyCombination.str.toUpperCase() in combinationToEl)) return;

	if (keyCombination.str in combinationToEl) combinationToEl[keyCombination.str].focus();
	else combinationToEl[keyCombination.str.toUpperCase()].focus();

	keyCombination.str = "";
	keyCombination.size = 0;
};

document.addEventListener("keydown", e => {
	if (e.repeat) return;
	if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
	const key = e.key === " " ? "Space" : e.key;
	keyCombinationHandler(key);
	shortcutHandler(key);
});

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
	el.appendChild(bubble);
}

(function appendStyle() {
	// Append bubble style to each website
	const style = document.createElement("style");
	style.innerHTML = `
	.ext-bubble {
		position: fixed;
		top: var(--top);
		left: var(--left);

		display: grid;
		width: var(--width);
		height: var(--height);

		border: 2px solid pink;
		border-radius: 2px;
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
		background: radial-gradient(circle at center, hsla(0,0%, 100%, 0.8), hsla(0,0%, 100%, 0.4));
		backdrop-filter: blur(5px);
		color: hsl(0, 0%, 8%) !important;
		
		font-size: var(--key-font-size);
		font-weight: 400;
	}
	`;
	document.head.appendChild(style);
})();
