import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    env: {
      PARENT_FATHER_EMAIL: "father@example.com",
      PARENT_MOTHER_EMAIL: "mother@example.com",
      PARENT_FATHER_CALENDAR_ID: "father-calendar@group.calendar.google.com",
      PARENT_MOTHER_CALENDAR_ID: "mother-calendar@group.calendar.google.com",
    },
    // Exclude abandoned parallel-agent git worktrees that still contain old source
    exclude: [
      "**/node_modules/**",
      "**/.{git,claude}/**",
    ],
  },
  resolve: {
    alias: [
      // Specific alias must come before the broad "@" alias.
      // Phase 12: src/config/app.ts is now the DB-backed async module (no longer gitignored).
      // The alias resolves to the actual file; tests that depend on config mock @/db instead.
      {
        find: "@/config/app",
        replacement: path.resolve(__dirname, "./src/config/app.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
})
