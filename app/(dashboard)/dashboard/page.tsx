'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { RefreshButton } from '@/components/refresh-button'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

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

interface ProfileData {
  printer_locations: unknown[]
  printer_bank_details: unknown | null
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending:   'outline',
  printing:  'secondary',
  completed: 'default',
  cancelled: 'destructive',
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [setupIncomplete, setSetupIncomplete] = useState(false)

  function fetchAll(silent = false) {
    if (!silent) setLoading(true)
    return Promise.all([
      api.get<JobsResponse>('/printer/jobs')
        .then((res) => setJobs(res.items ?? []))
        .catch(() => {}),
      api.get<{ data: ProfileData }>('/printer/profile')
        .then((res) => {
          const hasLocation = (res.data.printer_locations?.length ?? 0) > 0
          const hasBank = !!res.data.printer_bank_details
          setSetupIncomplete(!hasLocation || !hasBank)
        })
        .catch(() => {}),
    ]).finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => { fetchAll() }, [])

  const { refresh, lastRefreshed, refreshing } = useAutoRefresh(() => fetchAll(true))

  const total     = jobs.length
  const pending   = jobs.filter((j) => j.status === 'pending').length
  const printing  = jobs.filter((j) => j.status === 'printing').length
  const completed = jobs.filter((j) => j.status === 'completed').length
  const recent    = jobs.slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <RefreshButton onRefresh={refresh} lastRefreshed={lastRefreshed} refreshing={refreshing} />
      </div>

      {setupIncomplete && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">Complete your shop profile</p>
            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
              Add your location and bank details to start receiving orders.
            </p>
          </div>
          <Link
            href="/setup"
            className="ml-4 shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Complete Setup →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Total Jobs"  value={total}     />
          <StatCard title="Pending"     value={pending}   />
          <StatCard title="Printing"    value={printing}  />
          <StatCard title="Completed"   value={completed} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No jobs yet.</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id}</TableCell>
                    <TableCell className="font-mono text-xs">{job.orderId}</TableCell>
                    <TableCell>{job.productType}</TableCell>
                    <TableCell>{job.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status] ?? 'outline'}>
                        {job.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
