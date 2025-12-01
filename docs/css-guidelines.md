# CSS 全局规范

## 目标

- 根治全局样式污染，维持可预测的 UI 行为。
- 通过最小全局层 + 组件级封装，兑现 KISS 原则，避免重复定义和悬空的 reset。
- 将 Tailwind 和自定义 CSS 的职责拆分清楚，减少“越权”样式。

## 全局样式使用原则（KISS）

1. **最小表面积**：全局层仅允许声明色板、排版变量、基础背景/文字色。任何视觉语言只要和业务组件相关，就放在组件内。
2. **不可修改交互语义**：全局样式不能取消 outline、focus ring、pointer 行为，也不能拦截系统配色方案。
3. **一处声明，一处证明**：新增全局条目必须在 PR 说明里阐明用途，并链接对应组件或页面。
4. **base layer ≠ reset**：`@layer base` 只能做 token 注入或安全继承（如继承 border 颜色），禁止新增 `* { outline: … }` 之类的 reset。

> ✅ 正确示例
>
> ```css
> @layer base {
>   :root {
>     --surface-muted: oklch(0.98 0 0);
>   }
> }
> ```
>
> ❌ 错误示例
>
> ```css
> @layer base {
>   * {
>     outline: none;
>     border: none;
>   }
> }
> ```

## 禁止的全局 reset 模式

| 危险模式 | 原因 | 替代方案 |
| --- | --- | --- |
| `* { outline: none; }` / `*:focus-visible { outline: 0; }` | 破坏可访问性，难以追踪 | 在组件内用 `focus-visible:outline-[color]` 或 `focus:ring-*` 定制 |
| `* { border: 0; }` / `* { box-shadow: none; }` | 清空边框导致组件依赖顺序 | 仅针对特定组件/Slot 使用 `border-none` |
| `*:focus { box-shadow: none !important; }` | 阻断焦点反馈 | 使用 `focus:outline-none focus-visible:ring-2` 组合 |

> ❌ 错误示例（禁止）
>
> ```css
> /* 禁止：全局禁用 focus ring */
> *:focus {
>   outline: none;
>   box-shadow: none !important;
> }
> ```
>
> ✅ 正确示例
>
> ```css
> /* 仅对按钮组件做定制 */
> .btn-primary:focus-visible {
>   outline: 2px solid color-mix(in srgb, var(--primary) 80%, white);
>   outline-offset: 3px;
> }
> ```

## 推荐的组件级样式处理方式

- **优先 Tailwind**：90% 样式由 Tailwind 原子类完成，通过 `clsx`/`cva` 组合实现变体。
- **复杂状态使用 `@layer components`**：当 Tailwind 无法表达组合状态时，在 `@layer components` 中引入局部 class，命名需包含组件名前缀（如 `.post-card__toc`).
- **CSS Modules / scoped 文件**：对于需要媒体查询或第三方库覆盖的场景，放在 `components/<feature>/styles.module.css`，并通过 `import styles from './styles.module.css'` 绑定。
- **禁止“无家可归”选择器**：`.card h2 { ... }` 这样的后代选择器必须位于组件私有样式文件，且 `h2` 需具备 `data-slot` 或 BEM 前缀，避免影响其他 `h2`。

> ✅ 正确示例
>
> ```css
> @layer components {
>   .post-card__title {
>     @apply text-xl font-semibold tracking-tight;
>   }
> }
> ```
>
> ❌ 错误示例
>
> ```css
> @layer components {
>   h2 {
>     font-size: 48px;
>   }
> }
> ```

## Focus 样式最佳实践

1. **使用 `:focus-visible` 取代 `:focus`**，让鼠标用户避免多余 ring。
2. **outline/ring 采用 token**：颜色、粗细均引用 `--ring`、`--primary` 等 CSS 变量或 Tailwind 语义类，禁止硬编码 `#000`。
3. **提供 offset**：`outline-offset` ≥ 2px，避免 ring 被元素遮挡。
4. **组件在失焦时勿强制 `outline: none`**：若确实需要移除 outline，必须在同一规则中提供新的视觉反馈。

> ✅ 正确示例
>
> ```css
> .command-item:focus-visible {
>   outline: 2px solid var(--ring);
>   outline-offset: 4px;
> }
> ```
>
> ❌ 错误示例
>
> ```css
> .command-item:focus {
>   outline: none;
> }
> ```

## Tailwind 使用规范

1. **只在组件定义处拼接原子类**：禁止在 `globals.css` 中引入 Tailwind 功能类。
2. **`@apply` 仅用于语义化**：当某个模式在 3 处以上重复出现时才允许 `@apply`，避免把 Tailwind 当 SASS。
3. **Variant 首选 `cva`**：复杂状态优先用 `class-variance-authority` 定义，禁止堆叠 `condition ? 'px-4 py-2' : 'px-6 py-3'`。
4. **跳过“神奇数值”**：任何 `px`/`rem` 自定义值都要在注释中说明来源，否则改用 Tailwind spacing scale。
5. **禁止在 `@layer base` 写 `@apply focus:*`**：焦点类必须在组件层；base 层只负责 token。

> ✅ 正确示例
>
> ```ts
> const button = cva(
>   "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
>   {
>     variants: {
>       intent: {
>         primary: "bg-primary text-primary-foreground focus-visible:outline-primary",
>         subtle: "bg-muted text-muted-foreground focus-visible:outline-muted-foreground"
>       }
>     }
>   }
> )
> ```
>
> ❌ 错误示例
>
> ```css
> /* globals.css */
> @layer base {
>   button {
>     @apply focus-visible:outline-none;
>   }
> }
> ```

## 执行与审计

- Stylelint 规则：阻止选择器 `*:focus`, `*:focus-visible`, `*:focus-within`，并禁止 `outline: none/0` 等危险值（见 `.stylelintrc.json`).
- 代码评审清单：
> 1. 新的全局变量是否有组件引用？
> 2. 是否出现了 ban 列中的 reset？
> 3. Tailwind 是否被错误地写入 `globals.css`？
- 违规处理：发现一次回退并要求提交人追加说明，同时更新本指南案例库。
