import { defineConfig } from "vite";
import {lookupService} from "./worker/dev";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react(),lookupService()] });
