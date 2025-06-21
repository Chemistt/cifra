import Script from "next/script";

const CDN_SCRIPT = "https://unpkg.com/react-scan/dist/auto.global.js";

/**
 * ReactScan is a React functional component that conditionally injects the
 * react-scan script into the page during development mode.
 *
 * This component checks if the current environment is set to "development"
 * (using `process.env.NODE_ENV`). If so, it renders a `<Script>` tag that
 * loads the react-scan library from a CDN. In production or other environments,
 * it renders nothing.
 *
 * @returns The Script element for react-scan in development, or null otherwise.
 */
function ReactScan() {
	const isDevelopment = process.env.NODE_ENV === "development";

	return isDevelopment && <Script src={CDN_SCRIPT} />;
}

export { ReactScan };
