import { cn } from "@/lib/utils"
import type { TocItem } from "@/lib/markdown/toc"

interface TableOfContentsProps {
  items: TocItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="目录" className="border-border border-l pl-4">
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: Math.max(0, item.level - 2) * 12 }}>
            <a
              href={`#${item.id}`}
              className={cn(
                "text-muted-foreground hover:text-primary line-clamp-1 block text-sm transition-colors duration-200"
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
