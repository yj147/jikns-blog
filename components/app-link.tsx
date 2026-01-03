import Link from "next/link"
import type { ComponentProps } from "react"

export type AppLinkProps = ComponentProps<typeof Link>

export function AppLink({ prefetch, ...props }: AppLinkProps) {
  return <Link {...props} prefetch={prefetch === undefined ? false : prefetch} />
}

export default AppLink
