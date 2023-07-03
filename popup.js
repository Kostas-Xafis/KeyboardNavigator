chrome.storage.local.get("shortcut", ({ shortcut }) => {
	if (!shortcut) return;
	document.querySelector("#shortcut > input").value = shortcut;
});
chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
	if (!keyCombinations || !keyCombinations?.length) return;
	document.querySelectorAll("#keyCombinations > input").forEach((e, i) => (e.value = keyCombinations[i]));
});
chrome.storage.local.get("prefs", ({ prefs }) => {
	if (!prefs) return;
	document.querySelector("input[name='autoClose']").checked = prefs["autoClose"];
	document.querySelectorAll("input[type='color']").forEach(e => (e.value = prefs[e.name]));
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
	document.querySelectorAll("input[type='color']").forEach(e => (prefs[e.name] = e.value));
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
