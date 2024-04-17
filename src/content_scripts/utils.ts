export class InvisibleElements {
    elArr = new Set(); // 4ms faster

    constructor() { }
    setElements(clear = false) {
        this.elArr.clear();
        let recentParent = null; // 50% faster update & 10% faster display due size reduction
        document.querySelectorAll("body *:not(script, style)").forEach(e => {
            if (recentParent !== e.previousSibling) return;
            let cssRule = window.getComputedStyle(e);
            // Check for these css rules: {display: none, visibility: hidden, opacity: <=0.15} 
            if (cssRule.display[0] === "n" || cssRule.visibility[0] === "h" || Number(cssRule.opacity) <= 0.1) {
                this.elArr.add(e);
            } else this.elArr.delete(e);
        });
    }
    has = (el: HTMLElement) => this.elArr.has(el);
    isVisible = (el: HTMLElement) => {
        let parent = el;
        while (parent.tagName !== "BODY") {
            if (this.elArr.has(parent)) return false;
            parent = parent.parentNode as HTMLElement;
        }
        return true;
    };
}

export class FocusableElements {
    elements = new Map<string, HTMLElement>();

    isInViewport = (el: HTMLElement) => {
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

    setFocusable = (keycombs: string[], invisible: InvisibleElements) => {
        this.elements.clear();
        const elArr = [
            ...document.querySelectorAll(
                "input, select, a, button, textarea, [tabindex='0']:not(#ext-bubble-container)"
            ),
        ];
        for (let i = 0, j = 0; i < elArr.length; i++) {
            const e = elArr[i] as HTMLElement;
            // filter those that are not tabbable || are disabled || not in the screen
            if (e.tabIndex === -1 || (e as HTMLInputElement)?.disabled || !this.isInViewport(e) || !invisible.isVisible(e)) continue;

            // Map each element to a unique key press of length 2-3 and return the object
            let key = "";
            const l1 = keycombs[0].length;
            const l2 = keycombs[1].length;
            const l3 = l1 * l2;
            if (j < l3) {
                key = keycombs[0][Math.floor(j / l2)] + keycombs[1][j % l2];
            } else {
                let index = Math.floor(j / l3) - 1;
                let comb1 = index - l1 < 0 ? keycombs[0][index] : keycombs[1][index - l1];
                key = comb1 + keycombs[0][Math.floor(j / l2) % l1] + keycombs[1][Math.floor(j % l2)];
            }
            this.elements.set(key, e);
            j++;
        }
    };
    get = (key: string) => this.elements.get(key);
    has = (key: string) => this.elements.has(key);
    keys = () => this.elements.keys();
    forEach = (callback: (el: HTMLElement, key: string) => {}) => this.elements.forEach(callback, this);
}

// A class that can set an abortable timeout that can be reset
export class UpdateHandler {
    abortController = new AbortController();
    timeoutFired = false;
    func = () => { };
    timer = 0;
    timeout = (ms = 0) => {
        this.timeoutFired = true;
        return new Promise((res, rej) => {
            let tId = setTimeout(() => {
                this.timeoutFired = false;
                this.func.call(null);
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
    constructor(timer = 0, func = () => { }) {
        this.timer = timer;
        this.func = func;
    }
}
