import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: [
      // Specific alias must come before the broad "@" alias.
      // In CI / worktree environments, src/config/app.ts is gitignored;
      // map to the example file so tests can import and mock it.
      {
        find: "@/config/app",
        replacement: path.resolve(__dirname, "./src/config/app.example.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
})
