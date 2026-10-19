import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    // Agent worktrees are whole copies of the repo; their tests are not this tree's.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
  },
});
