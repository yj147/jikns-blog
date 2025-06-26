'use client'

import { useState, useRef, useEffect } from 'react'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  isOpen: boolean
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement>
}

// 表情数据
const emojiData = {
  // 主流 Emoji 表情
  emoji: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '🤣',
    '😂',
    '🙂',
    '🙃',
    '😉',
    '😊',
    '😇',
    '🥰',
    '😍',
    '🤩',
    '😘',
    '😗',
    '😚',
    '😙',
    '😋',
    '😛',
    '😜',
    '🤪',
    '😝',
    '🤑',
    '🤗',
    '🤭',
    '🤫',
    '🤔',
    '🤐',
    '🤨',
    '😐',
    '😑',
    '😶',
    '😏',
    '😒',
    '🙄',
    '😬',
    '🤥',
    '😔',
    '😪',
    '🤤',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '🥵',
    '🥶',
    '🥴',
    '😵',
    '🤯',
    '🤠',
    '🥳',
    '😎',
    '🤓',
    '🧐',
    '😕',
    '😟',
    '🙁',
    '☹️',
    '😮',
    '😯',
    '😲',
    '😳',
    '🥺',
    '😦',
    '😧',
    '😨',
    '😰',
    '😥',
    '😢',
    '😭',
    '😱',
    '😖',
    '😣',
    '😞',
    '😓',
    '😩',
    '😫',
    '🥱',
    '😤',
    '😡',
    '😠',
    '🤬',
    '😈',
    '👿',
    '💀',
    '☠️',
    '💩',
    '🤡',
    '👹',
    '👺',
    '👻',
    '👽',
    '👾',
    '🤖',
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '♥️',
    '👍',
    '👎',
    '👌',
    '🤌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🔥',
    '💯',
    '💢',
    '💥',
    '💫',
    '💦',
    '💨',
    '🕳️',
    '💣',
    '💤',
  ],

  // 颜文字
  kaomoji: [
    'OwO',
    'UwU',
    '(´･ω･`)',
    '(＾◡＾)',
    '(◕‿◕)',
    '(´∀｀)',
    '(￣▽￣)',
    '(´▽`)',
    '(＾▽＾)',
    '(◡ ‿ ◡)',
    '(´∇｀)',
    '(´∀｀)♡',
    '(´ε｀ )',
    '(╯°□°）╯',
    '┻━┻',
    '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
    '(☆▽☆)',
    '(｡◕‿◕｡)',
    '(⌐■_■)',
    '( ͡° ͜ʖ ͡°)',
    '¯\\_(ツ)_/¯',
    '(╭☞´ิ∀´ิ)╭☞',
    '(´｡• ᵕ •｡`)',
    '(◍•ᴗ•◍)',
    '(｡♥‿♥｡)',
    '(◕‿◕)♡',
    '(´∀｀)σ',
    '(´∀｀)ゞ',
    '(´∀｀)ﾉ',
    '(´∀｀)ﾉ彡',
    '(´∀｀)ﾉ⌒',
    '(´∀｀)ﾉ⌒☆',
    '(´∀｀)ﾉ⌒○',
    '(´∀｀)ﾉ⌒●',
    '(´∀｀)ﾉ⌒◎',
    '(´∀｀)ﾉ⌒◇',
    '(´∀｀)ﾉ⌒◆',
    '(´∀｀)ﾉ⌒■',
    '(´∀｀)ﾉ⌒□',
    '(´∀｀)ﾉ⌒▲',
    '(´∀｀)ﾉ⌒△',
    '(´∀｀)ﾉ⌒▼',
    '(´∀｀)ﾉ⌒▽',
  ],

  // 推特风格
  twitter: [
    '(｡◕‿◕｡)',
    '(◕‿◕)♡',
    '(◕‿◕)✿',
    '(◕‿◕)❀',
    '(◕‿◕)❁',
    '(◕‿◕)❂',
    '(◕‿◕)❃',
    '(◕‿◕)❄',
    '(◕‿◕)❅',
    '(◕‿◕)❆',
    '(◕‿◕)❇',
    '(◕‿◕)❈',
    '(◕‿◕)❉',
    '(◕‿◕)❊',
    '(◕‿◕)❋',
    '(◕‿◕)●',
    '(◕‿◕)○',
    '(◕‿◕)◎',
    '(◕‿◕)◇',
    '(◕‿◕)◆',
    '(◕‿◕)■',
    '(◕‿◕)□',
    '(◕‿◕)▲',
    '(◕‿◕)△',
    '(◕‿◕)▼',
    '(◕‿◕)▽',
    '(◕‿◕)♪',
    '(◕‿◕)♫',
    '(◕‿◕)♬',
    '(◕‿◕)♭',
    '(◕‿◕)♯',
    '(◕‿◕)♮',
    '(◕‿◕)♩',
    '(◕‿◕)♨',
    '(◕‿◕)♻',
    '(◕‿◕)♼',
    '(◕‿◕)♽',
    '(◕‿◕)♾',
    '(◕‿◕)⚀',
    '(◕‿◕)⚁',
  ],

  // 阿鲁系列
  alu: [
    '阿鲁',
    '阿鲁阿鲁',
    '阿鲁~',
    '阿鲁！',
    '阿鲁？',
    '阿鲁...',
    '阿鲁阿鲁阿鲁',
    '阿鲁(´∀｀)',
    '阿鲁(◕‿◕)',
    '阿鲁(´▽｀)',
    '阿鲁(＾◡＾)',
    '阿鲁(◡ ‿ ◡)',
    '阿鲁(´∇｀)',
    '阿鲁(´∀｀)♡',
    '阿鲁(´ε｀ )',
    '阿鲁(´∀｀)σ',
    '阿鲁(´∀｀)ゞ',
    '阿鲁(´∀｀)ﾉ',
    '阿鲁阿鲁~',
    '阿鲁阿鲁！',
    '阿鲁阿鲁？',
    '阿鲁阿鲁...',
    '阿鲁♪',
    '阿鲁♫',
    '阿鲁♬',
    '阿鲁♭',
    '阿鲁♯',
    '阿鲁♮',
  ],
}

const categoryNames = {
  emoji: '表情',
  kaomoji: '颜文字',
  twitter: '推特',
  alu: '阿鲁',
}

export default function EmojiPicker({
  onEmojiSelect,
  isOpen,
  onClose,
  triggerRef,
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof emojiData>('emoji')
  const pickerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
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

  // ESC 键关闭
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    // 选择表情后自动关闭选择器
    onClose()
  }

  return (
    <div
      ref={pickerRef}
      className="animate-in slide-in-from-bottom-2 absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white shadow-lg duration-200 dark:border-gray-600 dark:bg-gray-800"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-600">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">选择表情</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 分类标签 */}
      <div className="flex border-b border-gray-200 dark:border-gray-600">
        {Object.keys(emojiData).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category as keyof typeof emojiData)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeCategory === category
                ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400 border-b-2'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {categoryNames[category as keyof typeof categoryNames]}
          </button>
        ))}
      </div>

      {/* 表情网格 */}
      <div className="max-h-64 overflow-y-auto p-3">
        <div className="grid grid-cols-8 gap-1">
          {emojiData[activeCategory].map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="flex min-h-[2.5rem] items-center justify-center rounded p-2 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              title={emoji}
            >
              {activeCategory === 'emoji' ? (
                <span className="text-xl">{emoji}</span>
              ) : (
                <span className="text-center text-xs leading-tight">{emoji}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
