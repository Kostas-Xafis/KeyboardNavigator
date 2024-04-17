export type Shortcut = Record<number, {
    key: string;
    pressed: boolean;
}>;

export type Preferences = {
    autoClose: boolean;
    primaryColor: string;
    selectionColor: string;
    fontSize: string;
};

export type UserStorage = {
    shortcut: string;
    keyCombinations: string[];
    prefs: Preferences;
};