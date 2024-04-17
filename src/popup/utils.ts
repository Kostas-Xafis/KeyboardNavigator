import { Preferences } from "../content_scripts/types";

export class UserStorage {
    shortcut: string;
    keyCombinations: string[];
    prefs: Partial<Preferences>;

    shortcutInput: HTMLInputElement;
    keyCombinationsInputs: HTMLInputElement[];
    prefsInput: HTMLInputElement[];

    constructor(shortcut: string, keyCombinations: string[], prefs: Partial<Preferences>) {
        this.shortcut = shortcut;
        this.keyCombinations = keyCombinations;
        this.prefs = prefs;

        this.shortcutInput = document.querySelector<HTMLInputElement>("#shortcut > input")!;
        this.keyCombinationsInputs = [...document.querySelectorAll<HTMLInputElement>("#keyCombinations > input")];
        this.prefsInput = [...document.querySelectorAll<HTMLInputElement>(".prefs > input")];
    }

    static instance() {
        return new UserStorage("", [], {});
    }

    setStorage(key: keyof UserStorage, value: UserStorage[keyof UserStorage]) {
        if (key === "shortcut") {
            this.shortcut = value as string;
            chrome.storage.local.set({ "shortcut": this.shortcut }, () => { });
        } else if (key === "keyCombinations") {
            this.keyCombinations = value as string[];
            chrome.storage.local.set({ "keyCombinations": this.keyCombinations }, () => { });
        } else if (key === "prefs") {
            this.prefs = value as Preferences;
            chrome.storage.local.set({ "prefs": this.prefs }, () => { });
        }
    }

    setInputs<T extends keyof UserStorage>(name: T, value: UserStorage[T]) {
        switch (name) {
            case "shortcut":
                this.shortcutInput.value = value as string;
                break;
            case "keyCombinations":
                this.keyCombinationsInputs.forEach((e, i) => (e.value = (value as string[])[i]));
                break;
            case "prefs":
                let v = value as Preferences;
                (document.querySelector<HTMLInputElement>("input[name='autoClose']")!).checked = v["autoClose"];
                this.prefsInput.forEach(e => (e.value = "" + v[e.name as keyof Preferences] || ""));
                break;
            default:
                break;
        }
    }

    forEach(callback: (key: keyof UserStorage, value: UserStorage[keyof UserStorage]) => void) {
        for (const key in this) {
            callback(key as keyof UserStorage, this[key as keyof UserStorage]);
        }
    }

    install() {
        chrome.storage.local.get("install", ({ install }) => {
            if (!install) {
                const defaults = new UserStorage("Control+Space",
                    ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"],
                    {
                        autoClose: false,
                        primaryColor: "#33e7ff",
                        selectionColor: "#f17827",
                        fontSize: "16px",
                    });
                for (const key in defaults) {
                    let value = defaults[key as keyof UserStorage];
                    chrome.storage.local.set({ [key]: value }, console.log);
                    this.setInputs(key as keyof UserStorage, value as any);
                }
                chrome.storage.local.set({ install: true }, () => { });
                console.log("Installed defaults storage values successfully");
            } else {
                chrome.storage.local.get("shortcut", ({ shortcut }) => {
                    if (!shortcut) return;
                    this.setInputs("shortcut", shortcut);
                });
                chrome.storage.local.get("keyCombinations", ({ keyCombinations }) => {
                    if (!keyCombinations || !keyCombinations?.length) return;
                    this.setInputs("keyCombinations", keyCombinations);
                });
                chrome.storage.local.get("prefs", ({ prefs }) => {
                    if (!prefs) return;
                    this.setInputs("prefs", prefs);
                });
            }
        });
    }
}