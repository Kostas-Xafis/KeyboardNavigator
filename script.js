let executeShortcut = {
	0: { key: "Control", pressed: false },
	1: { key: "Space" }
};
let keyCombinations = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];
// listen for sync storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
		if (key === "shortcut") {
			const shortcut = newValue.split("+");
			let newShortcut = {};
			for (let i = 0; i < shortcut.length; i++) {
				newShortcut[i].key = shortcut[i];
				newShortcut[i].pressed = false;
			}
			executeShortcut = Object.assign({}, newShortcut);
		} else if (key === "keyCombinations") {
			keyCombinations = newValue;
		}
	}
});

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
const get_focusable = () => {
	const keyElMap = {};
	[...document.querySelectorAll("input, select, a, button, textarea")]
		// filter those that are not in the screen or are disabled or hidden
		.filter(e => {
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
			const key = keyCombinations[0][Math.floor(i / 10)] + keyCombinations[1][i % 10];
			keyElMap[key] = e;
		});
	return keyElMap;
};

// Create function toggleKeys that will create a small bubble next to each focusable element and inside the bubble will be the key
const toggleKeys = (toggle = true) => {
	if (!toggle) return document.querySelectorAll(".ext-bubble").forEach(e => e.remove());
	combinationToEl = get_focusable();
	for (const key in combinationToEl) {
		createBubble(combinationToEl[key], key);
	}
};

let show = true;
const shortcutHandler = e => {
	let i = 0;
	const length = Object.keys(executeShortcut).length;
	while (i < length - 1 && executeShortcut[i].pressed) i++;
	if (e.key === executeShortcut[i].key) executeShortcut[i].pressed = true;
	if (i === length - 1) {
		toggleKeys(show);
		show = !show;
		return;
	}
};

const keyCombination = { str: "", size: 0 };
const keyCombinationHandler = e => {
	if (show) {
		keyCombination.str = "";
		keyCombination.size = 0;
		return;
	}
	keyCombination.str += e.key;
	keyCombination.size++;
	if (keyCombination.size !== 2) return;

	if (keyCombination.str in combinationToEl) combinationToEl[keyCombination.str].focus();
	else if (keyCombination.str.toUpperCase() in combinationToEl) combinationToEl[keyCombination.str.toUpperCase()].focus();

	keyCombination.str = "";
	keyCombination.size = 0;
};

document.addEventListener("keydown", e => {
	if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
	e.key = e.key === " " ? "Space" : e.key;
	keyCombinationHandler(e);
	shortcutHandler(e);
});

document.addEventListener("keyup", e => {
	if (e.key === executeShortcut[0].key) executeShortcut[0].pressed = false;
});

function createBubble(el, key) {
	const bubble = document.createElement("div");
	bubble.classList.add("ext-bubble");
	const p = document.createElement("p");
	p.innerText = key;
	bubble.appendChild(p);

	const rect = el.getBoundingClientRect();
	bubble.style.setProperty("--height", rect.height + "px");
	bubble.style.setProperty("--width", rect.width + "px");
	bubble.style.setProperty("--top", rect.y + "px");
	bubble.style.setProperty("--left", rect.x + "px");

	el.appendChild(bubble);
}

function appendStyle() {
	const style = document.createElement("style");
	style.innerHTML = `
	.ext-bubble {
		position: absolute;
		top: 0;
		right: 0;
		height: 2.8rem;
		display: grid;
		place-content: center;
		background-color: blue;
		border-radius: 3px;
		box-shadow: -2px 2px 0px 1px hsl(0, 0%, 13%);
	}
	.ext-bubble::before {
		content: "";
		position: absolute;
		top: calc(0.4rem);
		left: 0;
		width: 0;
		border: 1rem solid transparent;
		transform: translate(-2rem);
		border-right-color: red;
	}
	.ext-bubble p {
		padding: 0.5rem;
		color: white;
		font-size: 1.8rem;
	}
	`;
	document.head.appendChild(style);
}
appendStyle();
