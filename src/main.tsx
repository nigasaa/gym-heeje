import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initializePwa } from "./pwa/lifecycle";
import "./styles/app.css";
document.documentElement.dataset.release =
  import.meta.env.VITE_RELEASE ?? "1.1.2";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
void initializePwa();
