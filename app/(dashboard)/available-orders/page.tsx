'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Clock, FileDown, MapPin, Package, IndianRupee } from 'lucide-react'
import { api } from '@/lib/api'
import { useBootstrap } from '@/context/bootstrap-context'
import { useRealtimeOrders } from '@/hooks/use-realtime-orders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface AvailableFile {
  id: string
  originalName: string | null
  fileKind: string | null
  url: string
}

interface AvailableOrder {
  orderId: string
  products: { name: string; category: string | null; quantity: number; options: string[] }[]
  deliveryCity: string | null
  deliveryPincode: string | null
  orderValue: number
  expectedDeliveryAt: string | null
  fileCount: number
  broadcastExpiresAt: string | null
  files: AvailableFile[]
}

function Countdown({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const urgent = remaining < 60000
  return (
    <Badge variant={urgent ? 'destructive' : 'secondary'} className="gap-1 font-mono">
      <Clock className="h-3 w-3" />
      {mins}:{secs.toString().padStart(2, '0')}
    </Badge>
  )
}

export default function AvailableOrdersPage() {
  const { profile } = useBootstrap()
  const [orders, setOrders] = useState<AvailableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  const fetchOrders = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    return api
      .get<{ data: { items: AvailableOrder[] } }>('/printer/available-orders')
      .then((res) => setOrders(res.data?.items ?? []))
      .catch((err) => toast.error(err.message ?? 'Failed to load available orders'))
      .finally(() => { if (!silent) setLoading(false) })
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Poll as a fallback / to expire stale cards even without realtime.
  useEffect(() => {
    const id = setInterval(() => fetchOrders(true), 15000)
    return () => clearInterval(id)
  }, [fetchOrders])

  // Realtime: refetch on broadcast, drop cards on accept/expire.
  useRealtimeOrders(profile?.id, (msg) => {
    if (msg.event === 'NewOrderBroadcasted') {
      toast.info('New order available nearby')
      fetchOrders(true)
    } else if (msg.event === 'OrderAccepted' || msg.event === 'OrderExpired' || msg.event === 'OrderAssignedAutomatically') {
      const orderId = msg.payload.orderId as string | undefined
      if (orderId) setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
    }
  })

  async function accept(orderId: string) {
    setAccepting(orderId)
    try {
      await api.post(`/printer/available-orders/${orderId}/accept`, {})
      toast.success('Order accepted! Customer details are now available in My Jobs.')
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept order')
      fetchOrders(true)
    } finally {
      setAccepting(null)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Available Orders</h1>
        <p className="text-sm text-muted-foreground">
          Accept within the time window. Customer details stay hidden until you accept.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          No orders available right now. New nearby orders will appear here instantly.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.orderId} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <CardTitle className="font-mono text-sm">#{order.orderId.slice(0, 8)}</CardTitle>
                <Countdown expiresAt={order.broadcastExpiresAt} />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="space-y-2">
                  {order.products.map((p, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {p.name} <span className="text-muted-foreground">×{p.quantity}</span>
                      </div>
                      {p.category && <div className="ml-6 text-xs text-muted-foreground">{p.category}</div>}
                      {p.options.length > 0 && (
                        <div className="ml-6 text-xs text-muted-foreground">{p.options.join(' · ')}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {order.deliveryCity ?? '—'}{order.deliveryPincode ? ` · ${order.deliveryPincode}` : ''}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <IndianRupee className="h-4 w-4" />{order.orderValue.toFixed(2)}
                  </span>
                </div>

                {order.expectedDeliveryAt && (
                  <div className="text-xs text-muted-foreground">
                    Expected delivery: {new Date(order.expectedDeliveryAt).toLocaleDateString()}
                  </div>
                )}

                {order.files.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Printing files</div>
                    {order.files.map((f) => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <FileDown className="h-3 w-3" />
                        {f.originalName ?? `${f.fileKind ?? 'file'}`}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <Button
                    className="w-full"
                    disabled={accepting === order.orderId}
                    onClick={() => accept(order.orderId)}
                  >
                    {accepting === order.orderId ? 'Accepting…' : 'Accept Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
