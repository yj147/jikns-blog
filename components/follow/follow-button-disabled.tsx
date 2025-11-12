/**
 * FollowButton 禁用状态组件
 * 当功能被禁用时显示的组件
 */

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface FollowButtonDisabledProps {
  dataTestId?: string
}

export function FollowButtonDisabled({ dataTestId }: FollowButtonDisabledProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-testid={dataTestId}
          disabled
          variant="outline"
          className="cursor-not-allowed opacity-70"
        >
          关注
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>该功能暂时维护中</TooltipContent>
    </Tooltip>
  )
}
