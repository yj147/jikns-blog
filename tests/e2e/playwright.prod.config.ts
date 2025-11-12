import baseConfig from "../../playwright.config"
import { defineConfig } from "@playwright/test"
import path from "path"

const projects = baseConfig.projects?.filter((project) => project.name === "chromium") || []
const testDir = path.resolve(__dirname)

export default defineConfig({
  ...baseConfig,
  testDir,
  use: {
    ...baseConfig.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3999",
  },
  projects,
  webServer: undefined,
})
