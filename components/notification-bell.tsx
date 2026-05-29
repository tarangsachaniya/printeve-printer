'use client'

import { useEffect, useState } from 'react'
import { BellIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])

  function load() {
    api.get<{ count: number }>('/printer/notifications/unread-count')
      .then(r => setCount(r.count))
      .catch(() => {})
    if (open) {
      api.get<{ items: Notification[] }>('/printer/notifications')
        .then(r => setItems(r.items ?? []))
        .catch(() => {})
    }
  }

  useEffect(() => { load() }, [open])

  async function markRead(id: string) {
    try {
      await api.patch(`/printer/notifications/${id}/read`, {})
      load()
    } catch { /* ignore */ }
  }

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="icon" className="relative" onClick={() => setOpen(v => !v)}>
        <BellIcon className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg">
            <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
            <div className="max-h-72 overflow-y-auto divide-y">
              {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">No notifications</p>
              ) : (
                items.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn('w-full text-left px-3 py-2.5 hover:bg-muted/50', !n.read && 'bg-primary/5')}
                    onClick={() => { if (!n.read) markRead(n.id) }}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
