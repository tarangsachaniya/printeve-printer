'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface ProductOptionValue { field_option_value_id: string; value: string }
interface ProductOption {
  field_definition_id: string
  label: string
  field_type: string
  values: ProductOptionValue[]
}

interface CatalogProduct {
  id: string
  name: string
  slug: string | null
  starting_price: number | null
  selected: boolean
}

// A priceable tier coming from the admin matrix (price stripped server-side).
interface TierTemplate {
  quantity: number
  max_completion_minutes: number | null
  city_id: string | null
  city_name: string | null
  option_value_ids: string[]
}

// A tier rendered in the editor: fixed structure + the printer's editable price.
interface TierRow extends TierTemplate {
  price: string
  completion: string
  optionLabels: string[]
}

function sameOptionSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((id, i) => id === sb[i])
}

export default function PricingPage() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([])
  // Products added locally this session but not yet persisted (no printer_pricing yet).
  const [localAdded, setLocalAdded] = useState<CatalogProduct[]>([])

  const [productId, setProductId] = useState('')
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add-product picker
  const [pickerOpen, setPickerOpen] = useState(false)

  const loadCatalog = useCallback(async () => {
    try {
      const res = await api.get<{ items: CatalogProduct[] }>('/printer/products')
      setCatalog(res.items ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load products')
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // Products the printer offers (persisted) plus any added this session.
  const myProducts = [
    ...catalog.filter((p) => p.selected),
    ...localAdded.filter((p) => !catalog.some((c) => c.id === p.id && c.selected)),
  ]
  // Catalog items not yet offered and not added locally — available to add.
  const addable = catalog.filter(
    (p) => !p.selected && !localAdded.some((l) => l.id === p.id),
  )

  const loadProduct = useCallback(async (pid: string) => {
    setLoading(true)
    try {
      // Only the OPTION CONFIG (for labels) and the tier TEMPLATE are read here —
      // the admin/customer price is never requested.
      const [prod, tpl, existing] = await Promise.all([
        api.get<{ data: { options: ProductOption[] } }>(`/printer/products/${pid}`),
        api.get<{ data: { items: TierTemplate[] } }>(`/printer/pricing/template?product_id=${pid}`),
        api.get<{ data: { items: any[] } }>(`/printer/pricing?product_id=${pid}`),
      ])

      const options = prod.data.options ?? []
      // field_option_value_id -> "Label: Value" for readable tier display
      const valueLabel = new Map<string, string>()
      for (const opt of options) {
        for (const v of opt.values) valueLabel.set(v.field_option_value_id, `${opt.label}: ${v.value}`)
      }

      const saved = existing.data?.items ?? []
      const rows: TierRow[] = (tpl.data?.items ?? []).map((t) => {
        const match = saved.find(
          (s) =>
            s.quantity === t.quantity &&
            (s.city_id ?? null) === (t.city_id ?? null) &&
            sameOptionSet(s.option_value_ids ?? [], t.option_value_ids),
        )
        return {
          ...t,
          price: match ? String(match.price) : '',
          completion:
            match?.max_completion_minutes != null
              ? String(match.max_completion_minutes)
              : t.max_completion_minutes != null
                ? String(t.max_completion_minutes)
                : '',
          optionLabels: t.option_value_ids.map((id) => valueLabel.get(id) ?? id),
        }
      })
      setTiers(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [])

  function selectProduct(pid: string | null) {
    const id = pid ?? ''
    setProductId(id)
    setTiers([])
    if (id) loadProduct(id)
  }

  function addProduct(p: CatalogProduct) {
    setLocalAdded((prev) => (prev.some((l) => l.id === p.id) ? prev : [...prev, p]))
    setPickerOpen(false)
    selectProduct(p.id)
  }

  function updateTier(i: number, patch: Partial<Pick<TierRow, 'price' | 'completion'>>) {
    setTiers((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        product_id: productId,
        rows: tiers
          .filter((t) => t.price !== '')
          .map((t) => ({
            quantity: t.quantity,
            price: Number(t.price),
            max_completion_minutes: t.completion ? Number(t.completion) : null,
            city_id: t.city_id,
            option_value_ids: t.option_value_ids,
          })),
      }
      await api.post('/printer/pricing', payload)
      toast.success('Your pricing has been saved')
      // Refresh catalog so the now-enrolled product reflects `selected: true`.
      await loadCatalog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save pricing')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">My Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Set the price you charge us for each tier of a product. These are your own rates.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="max-w-sm flex-1">
          <Label className="text-xs">Product</Label>
          {(() => {
            const selectedProductName = myProducts.find(p => p.id === productId)?.name
            return (
              <Select value={productId} onValueChange={selectProduct}>
                <SelectTrigger className="mt-1">
                  <span className={selectedProductName ? '' : 'text-muted-foreground'}>
                    {selectedProductName ?? 'Select one of your products'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {myProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          })()}
        </div>
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add product
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : productId ? (
        tiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Pricing for this product hasn&apos;t been configured yet, so there are no tiers to price.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {tier.optionLabels.map((lbl, k) => (
                        <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                          {lbl}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Qty {tier.quantity} · {tier.city_name ?? 'All Cities'}
                    </p>
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Your price (₹)</Label>
                    <Input type="number" min={0} step={0.01} value={tier.price} className="h-9 mt-1"
                      onChange={(e) => updateTier(i, { price: e.target.value })} />
                  </div>
                  <div className="w-36">
                    <Label className="text-xs">Completion (min)</Label>
                    <Input type="number" min={0} value={tier.completion} className="h-9 mt-1" placeholder="Optional"
                      onChange={(e) => updateTier(i, { completion: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save pricing'}
              </Button>
            </div>
          </>
        )
      ) : null}

      {/* Add product picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a product</DialogTitle>
            <DialogDescription>
              Pick a catalog product to set your own prices for. It is added to the products you offer when you save pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {addable.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No more catalog products to add.
              </p>
            ) : (
              addable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
