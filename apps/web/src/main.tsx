import "@mantine/core/styles.css";
import "@blurlab/design-system/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";

import {
    blurLabCssVariablesResolver,
    blurLabTheme,
} from "@blurlab/design-system";

import App from "./App";

const rootElement = document.getElementById("root");

if (rootElement === null) {
    throw new Error("Root element was not found.");
}

createRoot(rootElement).render(
    <StrictMode>
        <MantineProvider
            theme={blurLabTheme}
            cssVariablesResolver={
                blurLabCssVariablesResolver
            }
            forceColorScheme="dark"
        >
            <App />
        </MantineProvider>
    </StrictMode>,
);
