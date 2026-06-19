'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export function InfoTooltip({ text, side = 'bottom' }: { text: string; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  )
}
