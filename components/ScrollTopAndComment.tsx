'use client'

import siteMetadata from '@/data/siteMetadata'
import { useEffect, useState } from 'react'

// TOC项目类型定义
interface TocItem {
  value: string
  url: string
  depth: number
}

const ScrollTopAndComment = ({ toc }: { toc?: TocItem[] }) => {
  const [show, setShow] = useState(false)
  const [showToc, setShowToc] = useState(false)

  useEffect(() => {
    const handleWindowScroll = () => {
      if (window.scrollY > 50) setShow(true)
      else setShow(false)
    }

    window.addEventListener('scroll', handleWindowScroll)
    return () => window.removeEventListener('scroll', handleWindowScroll)
  }, [])

  const handleScrollTop = () => {
    window.scrollTo({ top: 0 })
  }
  const handleScrollToComment = () => {
    document.getElementById('comment')?.scrollIntoView()
  }

  const handleToggleToc = () => {
    setShowToc(!showToc)
  }

  const handleTocItemClick = (url: string) => {
    try {
      // 去掉 # 前缀获取 ID
      const id = url.startsWith('#') ? url.slice(1) : url

      // 首先尝试使用 getElementById
      let element = document.getElementById(id)

      // 如果找不到，尝试使用 querySelector（处理特殊字符）
      if (!element) {
        try {
          element = document.querySelector(url)
        } catch (e) {
          // 如果选择器无效，尝试转义特殊字符
          const escapedUrl = url.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&')
          element = document.querySelector(escapedUrl)
        }
      }

      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
        setShowToc(false) // 点击后关闭目录
      } else {
        console.warn(`无法找到目标元素: ${url}`)
      }
    } catch (error) {
      console.error('目录跳转失败:', error)
    }
  }
  return (
    <>
      {/* 浮动目录面板 */}
      {showToc && toc && toc.length > 0 && (
        <div className="fixed right-4 bottom-20 z-50 w-64 max-w-[calc(100vw-2rem)] md:right-8 md:bottom-24 md:max-w-xs">
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">目录</h3>
              <button
                onClick={() => setShowToc(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="关闭目录"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="space-y-1">
              {toc.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleTocItemClick(item.url)}
                  className={`block w-full text-left text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 ${
                    item.depth === 1
                      ? 'font-medium'
                      : item.depth === 2
                        ? 'pl-3'
                        : item.depth === 3
                          ? 'pl-6'
                          : 'pl-9'
                  }`}
                >
                  {item.value}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* 按钮组 */}
      <div
        className={`fixed right-4 bottom-4 md:right-8 md:bottom-8 ${show ? 'flex' : 'hidden'} z-40 flex-col gap-2 md:gap-3`}
      >
        {/* 目录按钮 */}
        {toc && toc.length > 0 && (
          <button
            aria-label="显示目录"
            onClick={handleToggleToc}
            className={`rounded-full bg-gray-200 p-2 text-gray-500 shadow-lg transition-all hover:bg-gray-300 hover:shadow-xl active:scale-95 md:p-3 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 ${
              showToc ? 'bg-primary-500 dark:bg-primary-600 text-white' : ''
            }`}
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {siteMetadata.comments?.provider && (
          <button
            aria-label="滚动到评论"
            onClick={handleScrollToComment}
            className="rounded-full bg-gray-200 p-2 text-gray-500 shadow-lg transition-all hover:bg-gray-300 hover:shadow-xl active:scale-95 md:p-3 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        <button
          aria-label="滚动到顶部"
          onClick={handleScrollTop}
          className="rounded-full bg-gray-200 p-2 text-gray-500 shadow-lg transition-all hover:bg-gray-300 hover:shadow-xl active:scale-95 md:p-3 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        >
          <svg className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </>
  )
}

export default ScrollTopAndComment
