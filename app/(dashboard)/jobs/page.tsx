'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

interface Job {
  id: string
  orderId: string
  productType: string
  quantity: number
  status: string
  createdAt: string
}

interface JobsResponse {
  items: Job[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending:   'outline',
  printing:  'secondary',
  completed: 'default',
  cancelled: 'destructive',
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<JobsResponse>('/printer/jobs')
      .then((res) => setJobs(res.items ?? []))
      .catch((err) => toast.error(err.message ?? 'Failed to load jobs'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Jobs</h1>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No jobs assigned yet.</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <TableCell className="font-mono text-xs">{job.id}</TableCell>
                  <TableCell className="font-mono text-xs">{job.orderId}</TableCell>
                  <TableCell>{job.productType}</TableCell>
                  <TableCell>{job.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[job.status] ?? 'outline'}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
