'use client'

import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface RefreshButtonProps {
  onRefresh: () => void
  lastRefreshed: Date | null
  refreshing: boolean
}

export function RefreshButton({ onRefresh, lastRefreshed, refreshing }: RefreshButtonProps) {
  return (
    <div className="flex items-center gap-2">
      {lastRefreshed && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          Updated {timeAgo(lastRefreshed)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-8 px-2"
        title="Refresh data"
      >
        <RotateCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
      </Button>
    </div>
  )
}
