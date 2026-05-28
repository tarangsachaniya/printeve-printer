'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrderFile {
  id: string
  fileUrl: string
  mimeType: string
  pageCount?: number
  dpi?: number
}

interface JobDetail {
  id: string
  orderId: string
  productType: string
  quantity: number
  status: string
  supportsColor?: boolean
  supportsBinding?: boolean
  supportsLamination?: boolean
  maxPaperSize?: string
  files?: OrderFile[]
  createdAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending:   'outline',
  printing:  'secondary',
  completed: 'default',
  cancelled: 'destructive',
}

const JOB_STATUSES = ['pending', 'printing', 'completed', 'cancelled']

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newStatus, setNewStatus] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  useEffect(() => {
    api.get<JobDetail>(`/printer/jobs/${id}`)
      .then((res) => {
        setJob(res)
        setNewStatus(res.status)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault()
    setUpdating(true)
    setUpdateMsg('')
    try {
      await api.patch(`/printer/status/${id}`, {
        status: newStatus,
        ...(proofUrl ? { proofUrl } : {}),
      })
      setJob((prev) => prev ? { ...prev, status: newStatus } : prev)
      setUpdateMsg('Status updated successfully.')
    } catch (err) {
      setUpdateMsg(err instanceof Error ? err.message : 'Update failed')
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
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/jobs')}>
          ← Back to Jobs
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/jobs')}>
          ←
        </Button>
        <h1 className="text-2xl font-bold">Job Details</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-y-2">
            <span className="text-muted-foreground">Job ID</span>
            <span className="font-mono">{job.id}</span>

            <span className="text-muted-foreground">Order ID</span>
            <span className="font-mono">{job.orderId}</span>

            <span className="text-muted-foreground">Product</span>
            <span>{job.productType}</span>

            <span className="text-muted-foreground">Quantity</span>
            <span>{job.quantity}</span>

            <span className="text-muted-foreground">Status</span>
            <Badge variant={STATUS_VARIANT[job.status] ?? 'outline'}>
              {job.status}
            </Badge>

            <span className="text-muted-foreground">Received</span>
            <span>{new Date(job.createdAt).toLocaleString()}</span>
          </div>

          {(job.supportsColor !== undefined || job.maxPaperSize) && (
            <div className="pt-2 border-t grid grid-cols-2 gap-y-2">
              {job.maxPaperSize && (
                <>
                  <span className="text-muted-foreground">Paper Size</span>
                  <span>{job.maxPaperSize}</span>
                </>
              )}
              {job.supportsColor !== undefined && (
                <>
                  <span className="text-muted-foreground">Color</span>
                  <span>{job.supportsColor ? 'Yes' : 'No'}</span>
                </>
              )}
              {job.supportsBinding !== undefined && (
                <>
                  <span className="text-muted-foreground">Binding</span>
                  <span>{job.supportsBinding ? 'Yes' : 'No'}</span>
                </>
              )}
              {job.supportsLamination !== undefined && (
                <>
                  <span className="text-muted-foreground">Lamination</span>
                  <span>{job.supportsLamination ? 'Yes' : 'No'}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {job.files && job.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Print Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">
                  {file.mimeType}
                  {file.pageCount ? ` · ${file.pageCount} pages` : ''}
                  {file.dpi ? ` · ${file.dpi} DPI` : ''}
                </span>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Download
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Update Status</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={v => setNewStatus(v ?? '')}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proofUrl">Proof URL (optional)</Label>
              <Input
                id="proofUrl"
                type="url"
                placeholder="https://..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
            </div>

            {updateMsg && (
              <p className={`text-sm ${updateMsg.includes('success') ? 'text-green-600' : 'text-destructive'}`}>
                {updateMsg}
              </p>
            )}

            <Button type="submit" disabled={updating || newStatus === job.status}>
              {updating ? 'Updating…' : 'Update Status'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
