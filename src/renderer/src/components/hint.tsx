import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type HintProps = {
  /** Tooltip text; when empty the child renders on its own. */
  readonly content: ReactNode
  /** A single element that can hold a ref, used as the trigger. */
  readonly children: ReactElement
  readonly side?: ComponentProps<typeof TooltipContent>['side']
}

/** The shadcn tooltip in place of the native `title` attribute. */
export const Hint = ({ content, children, side }: HintProps) =>
  content === null || content === undefined || content === '' ? (
    children
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-md break-words">
        {content}
      </TooltipContent>
    </Tooltip>
  )
