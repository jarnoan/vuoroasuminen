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
