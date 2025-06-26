# 表情选择器功能文档

## 🎯 功能概述

表情选择器是评论系统的一个重要增强功能，允许用户在评论中轻松插入各种表情符号和颜文字，提升评论的表达力和趣味性。

## ✨ 主要特性

### 🎭 **丰富的表情库**
- **主流 Emoji** - 包含 100+ 个常用 Emoji 表情
- **经典颜文字** - 日式颜文字和网络流行表情
- **推特风格** - 社交媒体常用表情组合
- **阿鲁系列** - 可爱的阿鲁主题表情

### 🎨 **用户体验**
- **智能插入** - 在光标位置精确插入表情
- **分类浏览** - 按类型组织，便于查找
- **连续选择** - 可连续选择多个表情
- **快捷操作** - 支持键盘快捷键

### 📱 **响应式设计**
- **移动端优化** - 适配触摸操作
- **自适应布局** - 根据屏幕尺寸调整
- **深色模式** - 完美支持深色主题

## 🚀 使用方法

### 基本操作

1. **打开选择器**
   - 点击评论输入框左下角的笑脸图标 😊

2. **选择表情**
   - 点击顶部标签切换分类
   - 点击任意表情插入到光标位置

3. **关闭选择器**
   - 点击右上角的 ✕ 按钮
   - 按 ESC 键
   - 点击选择器外部区域

### 快捷键

| 按键 | 功能 |
|------|------|
| `ESC` | 关闭表情选择器 |
| `Tab` | 在分类标签间切换 |

## 📋 表情分类

### 😊 表情 (Emoji)
包含主流的 Unicode Emoji 表情符号：

```
😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃
😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙
😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔
❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔
👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙
🔥 💯 💢 💥 💫 💦 💨 🕳️ 💣 💤
```

### (´∀｀) 颜文字 (Kaomoji)
经典的日式颜文字表情：

```
OwO, UwU, (´･ω･`), (＾◡＾), (◕‿◕)
(´∀｀), (￣▽￣), (´▽`), (＾▽＾), (◡ ‿ ◡)
(╯°□°）╯, ┻━┻, (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧, (☆▽☆)
(⌐■_■), ( ͡° ͜ʖ ͡°), ¯\_(ツ)_/¯
```

### (◕‿◕) 推特风格 (Twitter)
社交媒体流行的表情组合：

```
(｡◕‿◕｡), (◕‿◕)♡, (◕‿◕)✿, (◕‿◕)❀
(◕‿◕)●, (◕‿◕)○, (◕‿◕)◎, (◕‿◕)◇
(◕‿◕)♪, (◕‿◕)♫, (◕‿◕)♬, (◕‿◕)♭
```

### 阿鲁~ 阿鲁系列 (Alu)
可爱的阿鲁主题表情：

```
阿鲁, 阿鲁阿鲁, 阿鲁~, 阿鲁！, 阿鲁？
阿鲁(´∀｀), 阿鲁(◕‿◕), 阿鲁(´▽｀)
阿鲁♪, 阿鲁♫, 阿鲁♬
```

## 🔧 技术实现

### 组件架构

```tsx
// 主要组件
EmojiPicker.tsx          // 表情选择器主组件
CommentFormWithEmoji.tsx // 集成表情功能的评论表单
CommentForm.tsx          // 原始评论表单（已升级）
```

### 核心功能

#### 1. 表情插入逻辑

```tsx
const handleEmojiSelect = (emoji: string) => {
  const textarea = textareaRef.current
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentContent = formData.content
  
  // 在光标位置插入表情
  const newContent = currentContent.slice(0, start) + emoji + currentContent.slice(end)
  
  setFormData(prev => ({
    ...prev,
    content: newContent
  }))

  // 设置新的光标位置
  setTimeout(() => {
    const newCursorPos = start + emoji.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)
    textarea.focus()
  }, 0)
}
```

#### 2. 外部点击检测

```tsx
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      pickerRef.current && 
      !pickerRef.current.contains(event.target as Node) &&
      triggerRef?.current &&
      !triggerRef.current.contains(event.target as Node)
    ) {
      onClose()
    }
  }

  if (isOpen) {
    document.addEventListener('mousedown', handleClickOutside)
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside)
  }
}, [isOpen, onClose, triggerRef])
```

#### 3. 键盘事件处理

```tsx
useEffect(() => {
  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      onClose()
    }
  }

  document.addEventListener('keydown', handleEscKey)
  return () => document.removeEventListener('keydown', handleEscKey)
}, [isOpen, onClose])
```

## 🎨 样式定制

### CSS 类名

```css
/* 表情选择器容器 */
.emoji-picker {
  @apply absolute bottom-full left-0 mb-2 w-80 max-w-[90vw] 
         bg-white dark:bg-gray-800 border border-gray-200 
         dark:border-gray-600 rounded-lg shadow-lg z-50;
}

/* 表情按钮 */
.emoji-button {
  @apply p-2 rounded-md transition-all duration-200 hover:scale-110;
}

/* 表情网格 */
.emoji-grid {
  @apply grid grid-cols-8 gap-1 p-3 max-h-64 overflow-y-auto;
}
```

### 动画效果

```css
/* 弹出动画 */
@keyframes slide-in-from-bottom {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: slide-in-from-bottom 0.2s ease-out;
}
```

## 📱 响应式适配

### 移动端优化

```tsx
// 移动端表情尺寸调整
{activeCategory === 'emoji' ? (
  <span className="text-xl">{emoji}</span>
) : (
  <span className="text-xs text-center leading-tight">{emoji}</span>
)}
```

### 屏幕尺寸适配

```css
/* 小屏幕适配 */
@media (max-width: 768px) {
  .emoji-picker {
    width: 90vw;
    max-width: 320px;
  }
  
  .emoji-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
```

## 🔮 扩展功能

### 计划中的功能

1. **自定义表情包**
   - 用户上传自定义表情
   - 表情包管理界面

2. **表情搜索**
   - 按关键词搜索表情
   - 智能推荐功能

3. **使用统计**
   - 记录常用表情
   - 个性化推荐

4. **表情反应**
   - 对评论进行表情反应
   - 表情统计显示

### 集成建议

```tsx
// 未来扩展接口
interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  customEmojis?: CustomEmoji[]      // 自定义表情
  recentEmojis?: string[]           // 最近使用
  searchEnabled?: boolean           // 搜索功能
  categories?: EmojiCategory[]      // 自定义分类
}
```

## 🐛 故障排除

### 常见问题

1. **表情无法插入**
   - 检查 textarea ref 是否正确绑定
   - 确认光标位置获取正常

2. **选择器不显示**
   - 检查 z-index 层级
   - 确认 CSS 样式加载

3. **移动端体验差**
   - 检查触摸事件处理
   - 确认响应式样式

### 调试技巧

```tsx
// 添加调试信息
console.log('Emoji picker state:', {
  isOpen: showEmojiPicker,
  activeCategory,
  cursorPosition: textareaRef.current?.selectionStart
})
```

## 📚 相关文档

- [评论系统总体架构](./COMMENT_SYSTEM.md)
- [表情包角色功能](./COMMENT_EMOJI_FEATURE.md)
- [用户体验优化](./UX_OPTIMIZATION.md)
- [移动端适配指南](./MOBILE_ADAPTATION.md)
