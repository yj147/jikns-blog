'use client'

import { useEffect } from 'react'
import CustomKBarSearchProvider from './CustomKBarSearch'
import tagData from 'app/tag-data.json'
import { slug } from 'github-slugger'

// 热门标签注入组件
function HotTagsInjector() {
  useEffect(() => {
    // 获取热门标签数据
    const tagCounts = tagData as Record<string, number>
    const sortedTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([tag]) => tag)

    if (sortedTags.length === 0) return

    // 监听搜索界面的出现，用于注入热门标签
    const observer = new MutationObserver(() => {
      // 查找 kbar 的结果容器
      const kbarResults =
        document.querySelector('[data-kbar-results]') ||
        document.querySelector('.kbar-results') ||
        document.querySelector('[role="listbox"]')

      if (kbarResults && !document.getElementById('hot-tags-section')) {
        // 创建热门标签元素
        const hotTagsSection = document.createElement('div')
        hotTagsSection.id = 'hot-tags-section'
        hotTagsSection.style.cssText = `
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        `

        hotTagsSection.innerHTML = `
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <svg style="width: 16px; height: 16px; color: #ef4444; margin-right: 8px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span style="font-size: 14px; font-weight: 500; color: #374151;">热门标签</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${sortedTags
              .map(
                (tag) => `
              <a href="/tags/${slug(tag)}" style="
                display: inline-flex;
                align-items: center;
                padding: 8px 12px;
                font-size: 14px;
                background: white;
                color: #374151;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                text-decoration: none;
                transition: all 0.2s;
              " onmouseover="this.style.background='#dbeafe'; this.style.color='#1d4ed8'" onmouseout="this.style.background='white'; this.style.color='#374151'">
                <span style="font-size: 12px; opacity: 0.6; margin-right: 4px;">#</span>
                ${tag}
                <span style="margin-left: 4px; font-size: 12px; opacity: 0.5;">(${tagCounts[tag]})</span>
              </a>
            `
              )
              .join('')}
          </div>
          <div style="margin-top: 12px; font-size: 12px; color: #6b7280; text-align: center;">
            点击标签查看相关文章
          </div>
        `

        // 将热门标签添加到搜索界面底部
        const kbarAnimator =
          kbarResults.closest('[data-kbar-animator]') ||
          kbarResults.closest('.kbar-animator') ||
          kbarResults.parentElement

        if (kbarAnimator) {
          kbarAnimator.appendChild(hotTagsSection)
        }
      }
    })

    // 开始观察
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return null
}

// 包装组件，使用自定义KBar搜索并添加热门标签功能
interface SearchWithTagsProps {
  children: React.ReactNode
}

export default function SearchWithTags({ children }: SearchWithTagsProps) {
  return (
    <>
      <CustomKBarSearchProvider>{children}</CustomKBarSearchProvider>
      <HotTagsInjector />
    </>
  )
}
