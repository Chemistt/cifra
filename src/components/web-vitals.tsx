"use client";

import { useReportWebVitals } from "next/web-vitals";

function WebVitals() {
	const isDevelopment = process.env.NODE_ENV === "development";
	return isDevelopment && <InnerWebVitals />;
}

function InnerWebVitals() {
	useReportWebVitals((metric) => {
		console.log(metric);
	});

	return null; // eslint-disable-line unicorn/no-null
}

export { WebVitals };
