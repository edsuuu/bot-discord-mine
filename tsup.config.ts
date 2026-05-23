import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/Main.ts", "src/bot/DeployCommands.ts"],
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    sourcemap: true,
});
