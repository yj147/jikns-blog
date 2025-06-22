'use client'

import { useEffect, useState } from 'react'
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  useMatches,
  KBarResults,
  useRegisterActions,
  Action,
} from 'kbar'
import { useRouter } from 'next/navigation'
import siteMetadata from '@/data/siteMetadata'

// 博客文章类型定义
interface BlogPost {
  path: string
  title: string
  summary?: string
  date: string
}

// 格式化日期函数
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 自定义搜索模态框组件
function CustomKBarModal({ actions, isLoading }: { actions: Action[]; isLoading: boolean }) {
  useRegisterActions(actions, [actions])

  return (
    <KBarPortal>
      <KBarPositioner className="z-50 bg-gray-300/50 p-4 backdrop-blur backdrop-filter dark:bg-black/50">
        <KBarAnimator className="w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center space-x-4 p-4">
              <span className="block w-5">
                <svg
                  className="text-gray-400 dark:text-gray-300"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <KBarSearch
                className="h-8 w-full bg-transparent text-gray-600 placeholder-gray-400 focus:outline-none dark:text-gray-200 dark:placeholder-gray-500"
                defaultPlaceholder="输入关键词搜索"
              />
              <kbd className="inline-block rounded border border-gray-400 px-1.5 align-middle text-xs leading-4 font-medium tracking-wide whitespace-nowrap text-gray-400">
                ESC
              </kbd>
            </div>
            {!isLoading && <RenderResults />}
            {isLoading && (
              <div className="block border-t border-gray-100 px-4 py-8 text-center text-gray-400 dark:border-gray-800 dark:text-gray-600">
                加载中...
              </div>
            )}
          </div>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  )
}

// 渲染搜索结果组件
function RenderResults() {
  const { results } = useMatches()

  if (results.length) {
    return (
      <KBarResults
        items={results}
        onRender={({ item, active }) => (
          <div>
            {typeof item === 'string' ? (
              <div className="pt-3">
                <div className="text-primary-600 block border-t border-gray-100 px-4 pt-6 pb-2 text-xs font-semibold uppercase dark:border-gray-800">
                  {item}
                </div>
              </div>
            ) : (
              <div
                className={`flex cursor-pointer justify-between px-4 py-2 ${
                  active
                    ? 'bg-primary-600 text-gray-100'
                    : 'bg-transparent text-gray-700 dark:text-gray-100'
                }`}
              >
                <div className="flex space-x-2">
                  {item.icon && <div className="self-center">{item.icon}</div>}
                  <div className="block">
                    {item.subtitle && (
                      <div className={`${active ? 'text-gray-200' : 'text-gray-400'} text-xs`}>
                        {item.subtitle}
                      </div>
                    )}
                    <div>{item.name}</div>
                  </div>
                </div>
                {item.shortcut?.length ? (
                  <div aria-hidden className="flex flex-row items-center justify-center gap-x-2">
                    {item.shortcut.map((sc: string) => (
                      <kbd
                        key={sc}
                        className={`flex h-7 w-6 items-center justify-center rounded border text-xs font-medium ${
                          active ? 'border-gray-200 text-gray-200' : 'border-gray-400 text-gray-400'
                        }`}
                      >
                        {sc}
                      </kbd>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      />
    )
  } else {
    return (
      <div className="block border-t border-gray-100 px-4 py-8 text-center text-gray-400 dark:border-gray-800 dark:text-gray-600">
        没有找到相关结果...
      </div>
    )
  }
}

// 主要的KBar搜索提供者组件
export default function CustomKBarSearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [searchActions, setSearchActions] = useState<Action[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      // 类型守卫：检查是否为KBar配置
      if (siteMetadata.search?.provider === 'kbar' && 'kbarConfig' in siteMetadata.search) {
        const kbarConfig = siteMetadata.search.kbarConfig
        if (kbarConfig?.searchDocumentsPath) {
          try {
            const url =
              kbarConfig.searchDocumentsPath.indexOf('://') > 0 ||
              kbarConfig.searchDocumentsPath.indexOf('//') === 0
                ? kbarConfig.searchDocumentsPath
                : new URL(kbarConfig.searchDocumentsPath, window.location.origin)

            const res = await fetch(url)
            const json = await res.json()

            const actions = json.map((post: BlogPost) => ({
              id: post.path,
              name: post.title,
              keywords: post.summary || '',
              section: '内容', // 中文化的section
              subtitle: formatDate(post.date),
              perform: () => router.push('/' + post.path),
            }))

            setSearchActions(actions)
            setDataLoaded(true)
          } catch (error) {
            console.error('Failed to load search data:', error)
            setDataLoaded(true)
          }
        }
      } else {
        setDataLoaded(true)
      }
    }

    if (!dataLoaded) {
      fetchData()
    }
  }, [dataLoaded, router])

  return (
    <KBarProvider actions={[]}>
      <CustomKBarModal actions={searchActions} isLoading={!dataLoaded} />
      {children}
    </KBarProvider>
  )
}
