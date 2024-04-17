import { Preferences } from "./types";

export const injectCSS = (userPrefs: Preferences) => {
	// Remove all bubbles when there is url change (and therefor this script reruns)
	// but the bubble are still there
	const container = document.getElementById("ext-bubble-container");
	let innerHTML = "";
	if (container) {
		innerHTML = container.innerHTML;
		container.remove();
		document.getElementById("ext-bubble-style")?.remove();
	}

	let bubbleContainer = document.createElement("div");
	bubbleContainer.id = "ext-bubble-container";
	bubbleContainer.tabIndex = 0;
	bubbleContainer.innerHTML = innerHTML;
	// Append bubble style to each website
	const style = document.createElement("style");
	style.id = "ext-bubble-style";
	style.innerHTML = `
	#ext-bubble-container {
		--key-font-size: ${userPrefs.fontSize};

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

		border: 2px solid ${userPrefs.primaryColor};
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
	.ext-bubble-focus {
		border: 3px solid ${userPrefs.selectionColor};
	}
	`;
	document.body.appendChild(bubbleContainer);
	document.body.appendChild(style);
};