import { devices } from "@playwright/test";

// Without `defaultBrowserType`, which asks for WebKit: the suite runs Chromium.
const { defaultBrowserType: _webkit, ...phone } = devices["iPhone 12"];

export const iPhone12 = phone;
