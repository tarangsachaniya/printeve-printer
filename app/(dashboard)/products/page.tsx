'use client'

import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  ProductRequestForm,
  type ProductRequestPayload,
  type ProductRequestInitial,
} from '@/components/product-request-form'

interface Product {
  id: string
  name: string
  base_price: number
  selected: boolean
}

interface ProductRequestListItem {
  id: string
  name: string
  base_price: number
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
  created_at: string
}

interface ProductRequestDetail extends ProductRequestInitial {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [requests, setRequests] = useState<ProductRequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [requestDetail, setRequestDetail] = useState<ProductRequestDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      api.get<{ items: Product[] }>('/printer/products'),
      api.get<{ items: ProductRequestListItem[] }>('/printer/product-requests'),
    ])
      .then(([prods, reqs]) => {
        setProducts(prods.items ?? [])
        setRequests(reqs.items ?? [])
      })
      .catch(err => toast.error(err.message ?? 'Failed to load products'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function closeSheet() {
    setSheetOpen(false)
    setEditingId(null)
    setRequestDetail(null)
  }

  function openNewRequest() {
    setEditingId(null)
    setRequestDetail(null)
    setSheetOpen(true)
  }

  async function openRequest(id: string) {
    setEditingId(id)
    setRequestDetail(null)
    setSheetOpen(true)
    setLoadingDetail(true)
    try {
      const res = await api.get<{ data: ProductRequestDetail }>(`/printer/product-requests/${id}`)
      setRequestDetail(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load request')
      closeSheet()
    } finally {
      setLoadingDetail(false)
    }
  }

  async function toggle(product: Product) {
    setToggling(product.id)
    try {
      if (product.selected) {
        await api.delete(`/printer/products/${product.id}`)
      } else {
        await api.post(`/printer/products/${product.id}`, {})
      }
      setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, selected: !p.selected } : p)),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setToggling(null)
    }
  }

  async function handleSubmit(data: ProductRequestPayload) {
    setSaving(true)
    try {
      if (editingId) {
        await api.patch(`/printer/product-requests/${editingId}`, data)
        toast.success('Request updated')
      } else {
        await api.post('/printer/product-requests', data)
        toast.success('Product request submitted for admin review')
      }
      closeSheet()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save request')
    } finally {
      setSaving(false)
    }
  }

  const statusVariant = (s: ProductRequestListItem['status']) =>
    s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'

  const isNew = !editingId
  const readOnly = requestDetail != null && requestDetail.status !== 'pending'
  const sheetTitle = isNew
    ? 'Request new product'
    : requestDetail?.name ?? 'Product request'

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.filter(p => p.selected).length} of {products.length} catalog items selected
          </p>
        </div>
        <Button onClick={openNewRequest}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Request new product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My product requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No requests yet.</p>
          ) : (
            requests.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => openRequest(r.id)}
                className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{Number(r.base_price).toLocaleString('en-IN')} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Catalog</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground text-center">
              No products in catalog yet.
            </CardContent>
          </Card>
        ) : (
          products.map(product => (
            <Card key={product.id}>
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Base price: ₹{product.base_price?.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {product.selected && <Badge variant="default">Selected</Badge>}
                  <Button
                    size="sm"
                    variant={product.selected ? 'outline' : 'default'}
                    disabled={toggling === product.id}
                    onClick={() => toggle(product)}
                  >
                    {toggling === product.id ? '…' : product.selected ? 'Remove' : 'Add'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={open => { if (!open) closeSheet() }}>
        <SheetContent side="right" className="!w-[50vw] !max-w-none flex flex-col h-full p-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 pr-8">
              <SheetTitle>{sheetTitle}</SheetTitle>
              {requestDetail && (
                <Badge variant={statusVariant(requestDetail.status)}>{requestDetail.status}</Badge>
              )}
            </div>
            {requestDetail?.admin_notes && requestDetail.status === 'rejected' && (
              <p className="text-sm text-destructive mt-1">Admin note: {requestDetail.admin_notes}</p>
            )}
            {isNew && (
              <p className="text-sm text-muted-foreground">Submit details for admin approval.</p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingDetail ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <ProductRequestForm
                key={editingId ?? 'new'}
                initial={requestDetail ?? undefined}
                readOnly={readOnly}
                onSubmit={readOnly ? undefined : handleSubmit}
                saving={saving}
                hideSubmit
                submitLabel={isNew ? 'Submit for review' : 'Save changes'}
              />
            )}
          </div>

          {!readOnly && !loadingDetail && (
            <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeSheet} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="product-request-form"
                className="flex-1"
                disabled={saving}
              >
                {saving ? 'Saving…' : isNew ? 'Submit for review' : 'Save changes'}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
