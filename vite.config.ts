import { defineConfig } from "vite";
import { localCatalogue } from "./demo-server.mjs";

export default defineConfig({ base: "./", plugins: [localCatalogue()] });
