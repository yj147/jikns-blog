import { formatDate } from 'pliny/utils/formatDate'
import siteMetadata from '@/data/siteMetadata'

interface CopyrightNoticeProps {
  date: string
  title: string
  slug: string
}

export default function CopyrightNotice({ date, title, slug }: CopyrightNoticeProps) {
  const postUrl = `${siteMetadata.siteUrl}/blog/${slug}`
  const formattedDate = new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
      {/* 版权信息栏 */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        {/* 最后修改时间 */}
        <div className="flex items-center space-x-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>最后修改: {formattedDate}</span>
        </div>

        {/* 转载规范 */}
        <div className="group relative inline-flex items-center space-x-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="cursor-help">允许规范转载</span>

          {/* 悬停提示 */}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-lg bg-gray-900 px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-700">
            转载请保留原文链接，著作权归作者所有
            <div className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 transform border-t-4 border-r-4 border-l-4 border-t-gray-900 border-r-transparent border-l-transparent dark:border-t-gray-700"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
