'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderItem {
  product_type: string
  quantity: number
  unit_price: number
  total_price: number
  selected_options: { option_label: string; value_label: string }[]
  products?: { name: string } | null
}

interface JobDetail {
  id: string
  status: string
  assignment_type: string | null
  total: number
  subtotal: number
  delivery_fee: number
  platform_fee: number
  expected_delivery_at: string | null
  accepted_at: string | null
  created_at: string
  items: OrderItem[]
}

interface SignedFile {
  id: string
  originalName: string | null
  fileKind: string | null
  url: string
  version: number
  isCurrent: boolean
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  assigned: 'secondary', printing: 'secondary', out_for_delivery: 'secondary',
  delivered: 'default', cancelled: 'destructive',
}

const JOB_STATUSES = ['printing', 'out_for_delivery', 'delivered', 'cancelled']

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [files, setFiles] = useState<SignedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newStatus, setNewStatus] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<{ data: JobDetail }>(`/printer/jobs/${id}`),
      api.get<{ data: { current: SignedFile[]; history: SignedFile[] } }>(`/printer/jobs/${id}/files`).catch(() => null),
    ])
      .then(([res, filesRes]) => {
        setJob(res.data)
        setNewStatus(res.data.status)
        if (filesRes) setFiles(filesRes.data.history ?? [])
      })
      .catch((err) => setError(err.message ?? 'Failed to load job'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleUpdateStatus(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUpdating(true)
    try {
      await api.patch(`/printer/status/${id}`, { status: newStatus })
      setJob((prev) => (prev ? { ...prev, status: newStatus } : prev))
      toast.success('Status updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error || 'Job not found.'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/jobs')}>← Back to Jobs</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/jobs')}>←</Button>
        <h1 className="text-2xl font-bold">Order #{job.id.slice(0, 8)}</h1>
        <Badge variant={STATUS_VARIANT[job.status] ?? 'outline'}>{job.status}</Badge>
        {job.assignment_type && <Badge variant="outline">{job.assignment_type}</Badge>}
      </div>

      {job.expected_delivery_at && (
        <Card>
          <CardHeader><CardTitle>Delivery</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Expected delivery</span>
            <span>{new Date(job.expected_delivery_at).toLocaleDateString()}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {job.items.map((it, i) => (
            <div key={i} className="flex items-start justify-between border-b last:border-0 pb-2 last:pb-0">
              <div>
                <div className="font-medium">{it.products?.name ?? it.product_type} ×{it.quantity}</div>
                {Array.isArray(it.selected_options) && it.selected_options.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {it.selected_options.map((o) => `${o.option_label}: ${o.value_label}`).join(' · ')}
                  </div>
                )}
              </div>
              <div>₹{Number(it.total_price).toFixed(2)}</div>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-semibold">
            <span>Total</span><span>₹{Number(job.total).toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Print Files</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">
                  {file.originalName ?? file.fileKind ?? 'file'}
                  {!file.isCurrent ? ` · v${file.version} (old)` : ''}
                </span>
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <FileDown className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v ?? '')}>
                <SelectTrigger id="status" className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={updating || newStatus === job.status}>
              {updating ? 'Updating…' : 'Update Status'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
