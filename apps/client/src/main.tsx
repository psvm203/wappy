import React from "react";
import ReactDOM from "react-dom/client";
import "./tailwind.css";
import App from "./App";
import { DesktopOverlay } from "./DesktopOverlay";

const isDesktopOverlay =
  new URLSearchParams(window.location.search).get("view") === "desktop";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isDesktopOverlay ? <DesktopOverlay /> : <App />}
  </React.StrictMode>,
);
