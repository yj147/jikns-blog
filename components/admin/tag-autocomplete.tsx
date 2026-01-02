/**
 * 标签自动补全组件
 * Phase 10 - M4 阶段
 */

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Hash, Plus, Loader2 } from "lucide-react"
import { searchTags } from "@/lib/actions/tags"
import { useDebounce } from "@/hooks/use-debounce"
import { normalizeTagSlug } from "@/lib/utils/tag"
import { TagNameSchema } from "@/lib/validation/tag"
import { toast } from "sonner"

export interface TagAutocompleteItem {
  id: string
  name: string
  slug: string
  color?: string | null
}

const normalizeSlugForCompare = (slug?: string | null) => (slug ?? "").toLowerCase()

const hasSameSlug = (collection: TagAutocompleteItem[], slug?: string) => {
  if (!slug) return false
  const normalized = normalizeSlugForCompare(slug)
  return collection.some((item) => normalizeSlugForCompare(item.slug) === normalized)
}

const SEARCH_CACHE_TTL_MS = 30 * 1000
const RATE_LIMIT_COOLDOWN_FALLBACK_MS = 30 * 1000

interface TagAutocompleteProps {
  selectedTags: TagAutocompleteItem[]
  onTagsChange: (tags: TagAutocompleteItem[]) => void
  placeholder?: string
  maxTags?: number
  className?: string
}

export function TagAutocomplete({
  selectedTags,
  onTagsChange,
  placeholder = "搜索或创建标签...",
  maxTags = 10,
  className = "",
}: TagAutocompleteProps) {
  const [inputValue, setInputValue] = useState("")
  const [suggestions, setSuggestions] = useState<TagAutocompleteItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputError, setInputError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchCacheRef = useRef<
    Map<
      string,
      {
        timestamp: number
        results: TagAutocompleteItem[]
      }
    >
  >(new Map())
  const rateLimitUntilRef = useRef(0)
  const lastErrorCodeRef = useRef<string | null>(null)

  // 防抖搜索
  const debouncedSearchTerm = useDebounce(inputValue, 300)
  const searchRequestIdRef = useRef(0)

  // 搜索标签
  useEffect(() => {
    const trimmedTerm = debouncedSearchTerm.trim()

    const resetSuggestions = () => {
      searchRequestIdRef.current += 1
      setSuggestions([])
      setShowDropdown(false)
      setIsLoading(false)
      setSelectedIndex(-1)
    }

    if (!trimmedTerm || inputError) {
      resetSuggestions()
      return
    }

    const now = Date.now()
    if (now < rateLimitUntilRef.current) {
      setSuggestions([])
      setShowDropdown(false)
      setSelectedIndex(-1)
      setIsLoading(false)
      return
    }

    const requestId = ++searchRequestIdRef.current
    const cacheKey = trimmedTerm.toLowerCase()
    const cached = searchCacheRef.current.get(cacheKey)

    if (cached && now - cached.timestamp < SEARCH_CACHE_TTL_MS) {
      const filtered = cached.results.filter((tag) => !hasSameSlug(selectedTags, tag.slug))
      setSuggestions(filtered)
      setShowDropdown(filtered.length > 0 || trimmedTerm.length > 0)
      setSelectedIndex(filtered.length > 0 ? 0 : -1)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const searchForTags = async () => {
      try {
        const result = await searchTags(trimmedTerm)
        if (requestId !== searchRequestIdRef.current) {
          return
        }

        if (result.success && result.data?.tags) {
          searchCacheRef.current.set(cacheKey, { timestamp: Date.now(), results: result.data.tags })
          const filtered = result.data.tags.filter((tag) => !hasSameSlug(selectedTags, tag.slug))
          setSuggestions(filtered)
          setShowDropdown(filtered.length > 0 || trimmedTerm.length > 0)
          setSelectedIndex(filtered.length > 0 ? 0 : -1)
          lastErrorCodeRef.current = null
        } else {
          const errorCode = result.error?.code ?? "UNKNOWN_ERROR"
          if (errorCode === "RATE_LIMIT_EXCEEDED") {
            const retryAfterSeconds = Number(result.error?.details?.retryAfter)
            const cooldownMs =
              Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? retryAfterSeconds * 1000
                : RATE_LIMIT_COOLDOWN_FALLBACK_MS
            rateLimitUntilRef.current = Date.now() + cooldownMs
          }
          if (lastErrorCodeRef.current !== errorCode) {
            const toastFn = errorCode === "RATE_LIMIT_EXCEEDED" ? toast.warning : toast.error
            toastFn(result.error?.message || "搜索标签失败")
            lastErrorCodeRef.current = errorCode
          }
          setSuggestions([])
          setShowDropdown(false)
          setSelectedIndex(-1)
        }
      } catch (error) {
        if (requestId === searchRequestIdRef.current) {
          if (lastErrorCodeRef.current !== "NETWORK_ERROR") {
            toast.error("搜索标签失败")
            lastErrorCodeRef.current = "NETWORK_ERROR"
          }
          setSuggestions([])
          setShowDropdown(false)
          setSelectedIndex(-1)
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    }

    void searchForTags()
  }, [debouncedSearchTerm, selectedTags, inputError])

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 添加标签
  const addTag = useCallback(
    (tag: TagAutocompleteItem) => {
      if (selectedTags.length >= maxTags) {
        toast.warning(`最多只能选择 ${maxTags} 个标签`)
        return
      }

      // 防止重复
      if (hasSameSlug(selectedTags, tag.slug)) {
        return
      }

      onTagsChange([...selectedTags, tag])
      setInputValue("")
      setInputError(null)
      setSuggestions([])
      setShowDropdown(false)
      setSelectedIndex(-1)
      inputRef.current?.focus()
    },
    [selectedTags, maxTags, onTagsChange]
  )

  // 创建新标签
  const handleInputChange = (value: string) => {
    setInputValue(value)
    if (!value.trim()) {
      setInputError(null)
      return
    }

    const validation = TagNameSchema.safeParse(value)
    if (!validation.success) {
      setInputError(validation.error.errors[0]?.message ?? "标签名称无效")
    } else {
      setInputError(null)
    }
  }

  const createNewTag = useCallback(() => {
    if (inputError) {
      toast.error(inputError)
      return
    }

    const validation = TagNameSchema.safeParse(inputValue)
    if (!validation.success) {
      const message = validation.error.errors[0]?.message ?? "标签名称无效"
      setInputError(message)
      toast.error(message)
      return
    }

    const tagName = validation.data
    if (!tagName) return

    const normalizedSlug = normalizeTagSlug(tagName)

    // 检查是否已存在
    if (hasSameSlug(selectedTags, normalizedSlug)) {
      return
    }

    // 创建临时标签（实际创建会在保存文章时进行）
    const newTag: TagAutocompleteItem = {
      id: `new-${Date.now()}`,
      name: tagName,
      slug: normalizedSlug,
      color: null,
    }

    addTag(newTag)
  }, [inputValue, selectedTags, addTag, inputError])

  // 移除标签
  const removeTag = useCallback(
    (tagId: string) => {
      onTagsChange(selectedTags.filter((t) => t.id !== tagId))
    },
    [selectedTags, onTagsChange]
  )

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false)
      setSelectedIndex(-1)
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        addTag(suggestions[selectedIndex])
      } else if (inputValue.trim()) {
        createNewTag()
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
      return
    }

    if (e.key === "Backspace" && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id)
      return
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* 已选标签 */}
      {selectedTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <div key={tag.id}>
              <Badge
                variant="secondary"
                className="flex items-center gap-1 pr-1"
                style={
                  tag.color
                    ? {
                        backgroundColor: `${tag.color}20`,
                        borderColor: tag.color,
                        color: tag.color,
                      }
                    : {}
                }
              >
                <Hash className="h-3 w-3" />
                {tag.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeTag(tag.id)}
                  aria-label={`移除标签 ${tag.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowDropdown(true)}
          placeholder={selectedTags.length >= maxTags ? `最多选择 ${maxTags} 个标签` : placeholder}
          disabled={selectedTags.length >= maxTags}
          className="pr-10"
          aria-label="标签输入"
          aria-autocomplete="list"
          aria-controls="tag-suggestions"
          aria-expanded={showDropdown}
        />
        {isLoading && (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {inputError && <p className="text-destructive mt-2 text-sm">{inputError}</p>}

      {/* 下拉建议 */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="animate-in fade-in slide-in-from-top-2 absolute z-50 mt-2 w-full duration-200"
          id="tag-suggestions"
          role="listbox"
        >
          <Card>
            <CardContent className="p-2">
              {suggestions.length > 0 ? (
                <div className="space-y-1">
                  {suggestions.map((tag, index) => (
                    <button
                      key={tag.id}
                      onClick={() => addTag(tag)}
                      className={`hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-left transition-colors ${
                        index === selectedIndex ? "bg-accent" : ""
                      }`}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <Hash className="h-4 w-4" style={{ color: tag.color || undefined }} />
                      <span className="flex-1">{tag.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {tag.id.startsWith("new-") ? "新建" : "已存在"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : inputValue.trim() ? (
                <button
                  onClick={createNewTag}
                  disabled={!!inputError}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  <span>创建新标签 &ldquo;{inputValue.trim()}&rdquo;</span>
                </button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
