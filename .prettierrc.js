module.exports = {
  // 基础格式化选项
  semi: true,
  trailingComma: "es5",
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // JSX 特定选项
  jsxSingleQuote: true,
  jsxBracketSameLine: false,

  // 其他格式化选项
  quoteProps: "as-needed",
  bracketSpacing: true,
  arrowParens: "avoid",
  endOfLine: "lf",

  // 文件特定覆盖
  overrides: [
    {
      files: "*.json",
      options: {
        printWidth: 200,
      },
    },
    {
      files: "*.md",
      options: {
        printWidth: 120,
        proseWrap: "preserve",
      },
    },
    {
      files: ["*.yml", "*.yaml"],
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
  ],
}
