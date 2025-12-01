import stylelint from "stylelint";

const ruleName = "jikns/no-dangerous-global-reset";
const messages = stylelint.utils.ruleMessages(ruleName, {
  reset: (selector, prop) => `不要在全局选择器 "${selector}" 中重置 ${prop}，请在组件级样式里处理。`,
  apply: (selector, value) => `不要在全局选择器 "${selector}" 中 @apply ${value} 来移除 ring/outline。`
});

const globalSelectorMatchers = [
  /^\s*\*/,
  /\*:focus/, /\*:focus-visible/, /\*:focus-within/,
  /:where\(/, /:is\(/,
  /^\s*html\b/, /^\s*body\b/
];

const resetProps = new Set([
  "outline",
  "outline-color",
  "outline-width",
  "border",
  "border-color",
  "border-width",
  "box-shadow"
]);

const removalValuePattern = /(none|0|0px|transparent|initial|unset)(!?important)?$/i;
const dangerousApplyPattern = /(ring-0|ring-transparent|outline-none|focus-visible:outline-none|focus:outline-none|border-0)/;

const ruleFunction = (primaryOption, secondaryOptions = {}) => {
  if (primaryOption === false) {
    return () => {};
  }

  const allowSelectors = (secondaryOptions.allowSelectors || []).map((pattern) => new RegExp(pattern));

  return (root, result) => {
    const valid = stylelint.utils.validateOptions(result, ruleName, {
      actual: primaryOption,
      possible: [true]
    });

    if (!valid) return;

    root.walkRules((rule) => {
      const selector = (rule.selector || "").trim();
      if (!selector) return;
      if (allowSelectors.some((regex) => regex.test(selector))) return;
      const matchesGlobal = globalSelectorMatchers.some((regex) => regex.test(selector));
      if (!matchesGlobal) return;

      rule.walkDecls((decl) => {
        if (!resetProps.has(decl.prop?.toLowerCase())) return;
        const value = (decl.value || "").trim();
        if (!removalValuePattern.test(value)) return;
        stylelint.utils.report({
          message: messages.reset(selector, decl.prop),
          node: decl,
          result,
          ruleName
        });
      });

      rule.walkAtRules((atRule) => {
        if (atRule.name !== "apply") return;
        const params = atRule.params || "";
        if (!dangerousApplyPattern.test(params)) return;
        stylelint.utils.report({
          message: messages.apply(selector, params),
          node: atRule,
          result,
          ruleName
        });
      });
    });
  };
};

const rule = stylelint.createPlugin(ruleName, ruleFunction);

export { ruleName, messages };
export default rule;
