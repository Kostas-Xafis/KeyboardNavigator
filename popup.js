const setInput = {
	shortcut: shortcut => {
		document.querySelector("#shortcut > input").value = shortcut;
	},
	keyCombinations: keyCombinations => {
		document.querySelectorAll("#keyCombinations > input").forEach((e, i) => (e.value = keyCombinations[i]));
	},
	prefs: prefs => {
		document.querySelector("input[name='autoClose']").checked = prefs["autoClose"];
		document
			.querySelectorAll(".prefs > input:not([name='autoClose'])")
			.forEach(e => (e.value = prefs[e.name] || ""));
	},
};

chrome.storage.local.get("install", async ({ install }) => {
	console.log({ install });
	if (install) return;
	const defaults = {
		shortcut: "Control+Space",
		keyCombinations: ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"],
		prefs: {
			autoClose: false,
			primaryColor: "#33e7ff",
			selectionColor: "#f17827",
			fontSize: "16px",
		},
	};
	for (const key in defaults) {
		await chrome.storage.local.set({ [key]: defaults[key] }, console.log);
		setInput[key](defaults[key]);
	}
	await chrome.storage.local.set({ install: true }, () => {});
	console.log("Installed defaults successfully");
});

chrome.storage.local.get("shortcut", ({ shortcut }) => {
	console.log({ shortcut });
	if (!shortcut) return;
	setInput.shortcut(shortcut);
});
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
	console.log({ keyCombinations });
	if (!keyCombinations || !keyCombinations?.length) return;
	setInput.keyCombinations(keyCombinations);
});
chrome.storage.local.get("prefs", ({ prefs }) => {
	console.log({ prefs });
	if (!prefs) return;
	setInput.prefs(prefs);
});

document.querySelector("#shortcut > input").addEventListener("keydown", e => {
	if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
	e.preventDefault();
	e.stopPropagation();
	const input = e.currentTarget;
	const key = e.key === " " ? "Space" : e.key;
	if (input.value.length == 0) input.value = key;
	else input.value += "+" + key;
});

document.querySelector("#submit > button").addEventListener("click", async e => {
	const shortcut = document.querySelector("#shortcut > input").value;
	const keyCombinations = [...document.querySelectorAll("#keyCombinations > input")].map(e => e.value);
	const prefs = {
		autoClose: document.querySelector("input[name='autoClose']").checked,
	};
	document.querySelectorAll(".prefs > input:not([name='autoClose'])").forEach(e => (prefs[e.name] = e.value));
	console.log(prefs);
	//Check that each character in keyCombinations is unique
	const set = new Set();
	for (const key of keyCombinations[0].split("")) {
		if (set.has(key)) return alert("Key combinations must be unique");
		set.add(key);
	}
	set.clear();
	for (const key of keyCombinations[1].split("")) {
		if (set.has(key)) return alert("Key combinations must be unique");
		set.add(key);
	}
	if (shortcut.length == 0) return;

	await chrome.storage.local.set({ shortcut }, () => {});
	await chrome.storage.local.set({ keyCombinations }, () => {});
	await chrome.storage.local.set({ prefs }, () => {});
});

document.querySelectorAll("#settingsBar > button").forEach(e =>
	e.addEventListener("click", e => {
		document.querySelector(".active").classList.remove("active");
		e.currentTarget.classList.add("active");
	})
);
