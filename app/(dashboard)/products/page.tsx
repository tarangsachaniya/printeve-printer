'use client'

import { useEffect, useRef, useState } from 'react'
import { PlusIcon, TagIcon, MapPinIcon } from 'lucide-react'
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
import {
  PriceRequestForm,
  type PriceRequestPayload,
  type PriceRequestInitial,
} from '@/components/price-request-form'

interface Product {
  id: string
  name: string
  base_price: number
  selected: boolean
}

interface PaperSizeMeta { id: string; name: string }
interface PaperQualityMeta { id: string; gsm: number; label: string | null }
interface PaperTypeMeta { id: string; name: string }

interface ProductsListMeta {
  sizes: PaperSizeMeta[]
  qualities: PaperQualityMeta[]
  types: PaperTypeMeta[]
}

interface CityPricingItem {
  id: string
  city_id: string | null
  city_name: string | null
  city_state: string | null
  price_modifier: number | null
}

interface ProductDetail {
  id: string
  name: string
  base_price: number
  paper_sizes: { paper_size_id: string; price_modifier: number; name?: string }[]
  paper_qualities: { paper_quality_id: string; price_modifier: number; name?: string }[]
  paper_types: { paper_type_id: string; price_modifier: number; name?: string }[]
  quantity_slabs: {
    min_qty: number
    max_qty: number | null
    price_modifier: number
    max_completion_minutes: number | null
  }[]
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

interface PriceRequestListItem {
  id: string
  product_name: string | null
  base_price: number
  current_price: number | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
  notes?: string | null
  created_at: string
}

interface PriceRequestDetail extends PriceRequestInitial {
  id: string
  product_id: string | null
  product_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [requests, setRequests] = useState<ProductRequestListItem[]>([])
  const [priceRequests, setPriceRequests] = useState<PriceRequestListItem[]>([])
  const [paperSizes, setPaperSizes] = useState<PaperSizeMeta[]>([])
  const [paperQualities, setPaperQualities] = useState<PaperQualityMeta[]>([])
  const [paperTypes, setPaperTypes] = useState<PaperTypeMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  // --- product request sheet ---
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [requestDetail, setRequestDetail] = useState<ProductRequestDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const detailCache = useRef(new Map<string, ProductRequestDetail>())

  // --- city pricing sheet ---
  const [citySheetOpen, setCitySheetOpen] = useState(false)
  const [citySheetProduct, setCitySheetProduct] = useState<Product | null>(null)
  const [cityPricingItems, setCityPricingItems] = useState<CityPricingItem[]>([])
  const [loadingCityPricing, setLoadingCityPricing] = useState(false)

  // --- price request sheet ---
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)
  const [priceEditingId, setPriceEditingId] = useState<string | null>(null)
  const [priceRequestDetail, setPriceRequestDetail] = useState<PriceRequestDetail | null>(null)
  const [priceInitial, setPriceInitial] = useState<PriceRequestInitial | undefined>(undefined)
  const [priceProductId, setPriceProductId] = useState<string>('')
  const [priceProductName, setPriceProductName] = useState<string>('')
  const [loadingPriceDetail, setLoadingPriceDetail] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const priceDetailCache = useRef(new Map<string, PriceRequestDetail>())

  function load() {
    setLoading(true)
    Promise.all([
      api.get<{ items: Product[]; meta: ProductsListMeta }>('/printer/products'),
      api.get<{ items: ProductRequestListItem[] }>('/printer/product-requests'),
      api.get<{ items: PriceRequestListItem[] }>('/printer/product-price-requests'),
    ])
      .then(([prods, reqs, priceReqs]) => {
        setProducts(prods.items ?? [])
        setPaperSizes(prods.meta?.sizes ?? [])
        setPaperQualities(prods.meta?.qualities ?? [])
        setPaperTypes(prods.meta?.types ?? [])
        setRequests(reqs.items ?? [])
        setPriceRequests(priceReqs.items ?? [])
      })
      .catch(err => toast.error(err.message ?? 'Failed to load products'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ---- city pricing handlers ----
  async function openCityPricing(product: Product) {
    setCitySheetProduct(product)
    setCityPricingItems([])
    setCitySheetOpen(true)
    setLoadingCityPricing(true)
    try {
      const res = await api.get<{ items: CityPricingItem[] }>(`/printer/products/${product.id}/city-pricing`)
      setCityPricingItems(res.items ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load city pricing')
    } finally {
      setLoadingCityPricing(false)
    }
  }

  // ---- product request handlers ----
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
    setSheetOpen(true)
    const cached = detailCache.current.get(id)
    if (cached) { setRequestDetail(cached); return }
    setRequestDetail(null)
    setLoadingDetail(true)
    try {
      const res = await api.get<{ data: ProductRequestDetail }>(`/printer/product-requests/${id}`)
      setRequestDetail(res.data)
      detailCache.current.set(id, res.data)
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
        detailCache.current.delete(editingId)
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

  // ---- price request handlers ----
  function closePriceSheet() {
    setPriceSheetOpen(false)
    setPriceEditingId(null)
    setPriceRequestDetail(null)
    setPriceInitial(undefined)
    setPriceProductId('')
    setPriceProductName('')
  }

  async function openPriceRequestForProduct(product: Product) {
    setPriceEditingId(null)
    setPriceProductId(product.id)
    setPriceProductName(product.name)
    setPriceRequestDetail(null)
    setPriceSheetOpen(true)
    setLoadingPriceDetail(true)
    try {
      const res = await api.get<{ data: ProductDetail }>(`/printer/products/${product.id}`)
      setPriceInitial({
        base_price: res.data.base_price,
        paper_sizes: res.data.paper_sizes,
        paper_qualities: res.data.paper_qualities,
        paper_types: res.data.paper_types,
        quantity_slabs: res.data.quantity_slabs,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load product pricing')
    } finally {
      setLoadingPriceDetail(false)
    }
  }

  async function openPriceRequest(item: PriceRequestListItem) {
    setPriceEditingId(item.id)
    setPriceProductId('')
    setPriceProductName(item.product_name ?? '')
    setPriceRequestDetail(null)
    setPriceInitial(undefined)
    setPriceSheetOpen(true)
    const cached = priceDetailCache.current.get(item.id)
    if (cached) {
      setPriceRequestDetail(cached)
      setPriceInitial({
        base_price: cached.base_price,
        paper_sizes: cached.paper_sizes,
        paper_qualities: cached.paper_qualities,
        paper_types: cached.paper_types,
        quantity_slabs: cached.quantity_slabs,
        notes: cached.notes,
      })
      if (cached.product_id) setPriceProductId(cached.product_id)
      return
    }
    setLoadingPriceDetail(true)
    try {
      const res = await api.get<{ data: PriceRequestDetail }>(`/printer/product-price-requests/${item.id}`)
      priceDetailCache.current.set(item.id, res.data)
      setPriceRequestDetail(res.data)
      setPriceInitial({
        base_price: res.data.base_price,
        paper_sizes: res.data.paper_sizes,
        paper_qualities: res.data.paper_qualities,
        paper_types: res.data.paper_types,
        quantity_slabs: res.data.quantity_slabs,
        notes: res.data.notes,
      })
      if (res.data.product_id) setPriceProductId(res.data.product_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load request')
      closePriceSheet()
    } finally {
      setLoadingPriceDetail(false)
    }
  }

  async function handlePriceSubmit(data: PriceRequestPayload) {
    setSavingPrice(true)
    try {
      if (priceEditingId) {
        await api.patch(`/printer/product-price-requests/${priceEditingId}`, data)
        priceDetailCache.current.delete(priceEditingId)
        toast.success('Price request updated')
      } else {
        await api.post('/printer/product-price-requests', data)
        toast.success('Price change request submitted for admin review')
      }
      closePriceSheet()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save request')
    } finally {
      setSavingPrice(false)
    }
  }

  const statusVariant = (s: 'pending' | 'approved' | 'rejected') =>
    s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'

  const isNew = !editingId
  const readOnly = requestDetail != null && requestDetail.status !== 'pending'
  const sheetTitle = isNew ? 'Request new product' : requestDetail?.name ?? 'Product request'

  const isPriceNew = !priceEditingId
  const priceReadOnly = priceRequestDetail != null && priceRequestDetail.status !== 'pending'
  const priceSheetTitle = isPriceNew
    ? `Request price change — ${priceProductName}`
    : priceProductName || 'Price change request'

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

      {/* Product requests */}
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
                className="flex w-full flex-col rounded-lg border px-4 py-3 text-left hover:bg-muted/40 transition-colors gap-1"
              >
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-medium">{r.name}</p>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ₹{Number(r.base_price).toLocaleString('en-IN')} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.status === 'rejected' && r.admin_notes && (
                  <p className="text-xs text-destructive mt-0.5">Reason: {r.admin_notes}</p>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Price change requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My price change requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : priceRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No price requests yet. Use &ldquo;Request price change&rdquo; on a selected product below.</p>
          ) : (
            priceRequests.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => openPriceRequest(r)}
                className="flex w-full flex-col rounded-lg border px-4 py-3 text-left hover:bg-muted/40 transition-colors gap-1"
              >
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-medium">{r.product_name ?? '—'}</p>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.current_price != null && <>₹{Number(r.current_price).toLocaleString('en-IN')} → </>}
                  ₹{Number(r.base_price).toLocaleString('en-IN')} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.status === 'rejected' && r.admin_notes && (
                  <p className="text-xs text-destructive mt-0.5">Reason: {r.admin_notes}</p>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Catalog */}
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
                <div className="flex items-center gap-2">
                  {product.selected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCityPricing(product)}
                    >
                      <MapPinIcon className="h-3.5 w-3.5 mr-1" />
                      City pricing
                    </Button>
                  )}
                  {product.selected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPriceRequestForProduct(product)}
                    >
                      <TagIcon className="h-3.5 w-3.5 mr-1" />
                      Request price change
                    </Button>
                  )}
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

      {/* Product request sheet */}
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
                paperSizes={paperSizes}
                paperTypes={paperTypes}
              />
            )}
          </div>

          {!readOnly && !loadingDetail && (
            <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeSheet} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="product-request-form" className="flex-1" disabled={saving}>
                {saving ? 'Saving…' : isNew ? 'Submit for review' : 'Save changes'}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Price request sheet */}
      <Sheet open={priceSheetOpen} onOpenChange={open => { if (!open) closePriceSheet() }}>
        <SheetContent side="right" className="!w-[50vw] !max-w-none flex flex-col h-full p-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 pr-8">
              <SheetTitle>{priceSheetTitle}</SheetTitle>
              {priceRequestDetail && (
                <Badge variant={statusVariant(priceRequestDetail.status)}>{priceRequestDetail.status}</Badge>
              )}
            </div>
            {priceRequestDetail?.admin_notes && priceRequestDetail.status === 'rejected' && (
              <p className="text-sm text-destructive mt-1">Admin note: {priceRequestDetail.admin_notes}</p>
            )}
            {isPriceNew && (
              <p className="text-sm text-muted-foreground">Propose new pricing for admin approval. Fields are pre-filled with current values.</p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingPriceDetail ? (
              <div className="space-y-7">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            ) : (
              <PriceRequestForm
                key={priceEditingId ?? `new-${priceProductId}`}
                productId={priceProductId}
                initial={priceInitial}
                readOnly={priceReadOnly}
                onSubmit={priceReadOnly ? undefined : handlePriceSubmit}
                saving={savingPrice}
                hideSubmit
                paperSizes={paperSizes}
                paperQualities={paperQualities}
                paperTypes={paperTypes}
              />
            )}
          </div>

          {!priceReadOnly && !loadingPriceDetail && (
            <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closePriceSheet} disabled={savingPrice}>
                Cancel
              </Button>
              <Button type="submit" form="price-request-form" className="flex-1" disabled={savingPrice}>
                {savingPrice ? 'Saving…' : isPriceNew ? 'Submit for review' : 'Save changes'}
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* City pricing sheet */}
      <Sheet open={citySheetOpen} onOpenChange={open => { if (!open) setCitySheetOpen(false) }}>
        <SheetContent side="right" className="!w-[480px] !max-w-none flex flex-col h-full p-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
              City pricing — {citySheetProduct?.name}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              City-specific price overrides configured by admin.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loadingCityPricing ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : cityPricingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No city-specific pricing configured for this product.
              </p>
            ) : (
              <div className="space-y-3">
                {cityPricingItems.map(item => (
                  <div key={item.id} className="rounded-lg border px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.city_name}</p>
                      <Badge variant="outline" className="text-xs">{item.city_state}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      City price modifier:{' '}
                      {item.price_modifier != null
                        ? <span className="font-medium text-foreground">{Number(item.price_modifier) >= 0 ? '+' : ''}₹{Number(item.price_modifier).toLocaleString('en-IN')}</span>
                        : <span className="italic">₹0 (No modifier)</span>
                      }
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" className="w-full" onClick={() => setCitySheetOpen(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
