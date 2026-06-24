'use client'

import { useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'

export type OrderRealtimeEvent =
  | 'NewOrderBroadcasted'
  | 'OrderAccepted'
  | 'OrderExpired'
  | 'OrderAssignedAutomatically'

export interface RealtimeOrderMessage {
  event: OrderRealtimeEvent
  payload: Record<string, unknown>
}

/**
 * Subscribes to this printer's realtime dashboard channels:
 *   - `printer:<id>`     targeted events (assigned to me, I won, etc.)
 *   - `orders:broadcast` fan-out events (new order, taken, expired)
 *
 * Falls back silently when Supabase Realtime isn't configured — callers should
 * also poll. Returns nothing; invoke `onEvent` for each message.
 */
export function useRealtimeOrders(
  printerId: string | null | undefined,
  onEvent: (msg: RealtimeOrderMessage) => void,
) {
  const cb = useRef(onEvent)
  cb.current = onEvent

  useEffect(() => {
    if (!printerId) return
    const supabase = getSupabase()
    if (!supabase) return

    const handle = (event: OrderRealtimeEvent) => (msg: { payload: Record<string, unknown> }) => {
      cb.current({ event, payload: msg.payload ?? {} })
    }

    const topics = [`printer:${printerId}`, 'orders:broadcast']
    const channels = topics.map((topic) => {
      const ch = supabase.channel(topic)
      ;(['NewOrderBroadcasted', 'OrderAccepted', 'OrderExpired', 'OrderAssignedAutomatically'] as OrderRealtimeEvent[])
        .forEach((event) => ch.on('broadcast', { event }, handle(event)))
      ch.subscribe()
      return ch
    })

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [printerId])
}
