module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  rules: {
    // 基础代码质量规则
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
    "prefer-const": "error",
    "no-var": "error",
  },
  overrides: [
    {
      // 测试文件特殊规则
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
      env: {
        jest: true,
      },
      rules: {
        "no-console": "off",
      },
    },
  ],
}
