import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCloudflareAnalyticsAttributes } from "@ship72/ui";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Application root is missing.");
}

const analytics = getCloudflareAnalyticsAttributes(import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN);
if (analytics) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = analytics.src;
  script.dataset.cfBeacon = analytics.beacon;
  document.head.append(script);
}

createRoot(root).render(<StrictMode><App /></StrictMode>);
