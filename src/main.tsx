import "@fontsource-variable/dm-sans";
import "@fontsource/libre-caslon-display/latin-400.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/tokens.css";
import "./styles/app.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
