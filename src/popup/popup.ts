import { Preferences } from "../content_scripts/types";
import { UserStorage } from "./utils";

type Input = HTMLInputElement;

const storage = UserStorage.instance();
storage.install();

document.querySelector<Input>("#shortcut > input")!.addEventListener("keydown", (e: KeyboardEvent) => {
	if (e.key === "Shift" || e.key === "Backspace") return; // To allow capital letters
	e.preventDefault();
	e.stopPropagation();
	const input = e.currentTarget as Input;
	const key = e.key === " " ? "Space" : e.key;
	if (input.value.length == 0) input.value = key;
	else input.value += "+" + key;
});

document.querySelector("#submit > button")?.addEventListener("click", e => {
	const shortcut = storage.shortcutInput!.value;
	const keyCombinations = storage.keyCombinationsInputs.map(e => e.value);
	const prefs: Partial<Preferences> = {
		autoClose: document.querySelector<Input>("input[name='autoClose']")!.checked,
	};
	storage.prefsInput.forEach(e => {
		let name = e.name as keyof Preferences;
		if (name === "autoClose") return;
		prefs[name] = e.value;
	});
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

	storage.setStorage("shortcut", shortcut);
	storage.setStorage("keyCombinations", keyCombinations);
	storage.setStorage("prefs", prefs);
});

document.querySelectorAll("#settingsBar > button").forEach(e =>
	e.addEventListener("click", e => {
		document.querySelector<HTMLElement>(".active")?.classList.remove("active");
		(e.currentTarget as HTMLElement)?.classList.add("active");
	})
);
