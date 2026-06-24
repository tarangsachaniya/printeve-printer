'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useBootstrap } from '@/context/bootstrap-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProductOptionValue { field_option_value_id: string; value: string }
interface ProductOption {
  field_definition_id: string
  label: string
  field_type: string
  values: ProductOptionValue[]
}
interface City { id: string; name: string }

interface PricingRow {
  quantity: string
  price: string
  max_completion_minutes: string
  city_id: string | null
  // field_definition_id -> field_option_value_id
  options: Record<string, string>
}

const OPTION_TYPES = new Set(['select', 'multi_select', 'boolean', 'radio'])

export default function PricingPage() {
  const { products } = useBootstrap()
  const offered = (products ?? []).filter((p) => p.selected)

  const [productId, setProductId] = useState('')
  const [options, setOptions] = useState<ProductOption[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<{ items: City[] }>('/printer/cities/all')
      .then((res) => setCities(res.items ?? []))
      .catch(() => {})
  }, [])

  const loadProduct = useCallback(async (pid: string) => {
    setLoading(true)
    try {
      // Only the OPTION CONFIG is read here — the admin/customer price is never requested.
      const prod = await api.get<{ data: { options: ProductOption[] } }>(`/printer/products/${pid}`)
      const opts = (prod.data.options ?? []).filter((o) => OPTION_TYPES.has(o.field_type))
      setOptions(opts)

      const existing = await api.get<{ data: { items: any[] } }>(`/printer/pricing?product_id=${pid}`)
      const loaded: PricingRow[] = (existing.data?.items ?? []).map((r) => {
        const optionMap: Record<string, string> = {}
        for (const opt of opts) {
          const match = opt.values.find((v) => r.option_value_ids.includes(v.field_option_value_id))
          if (match) optionMap[opt.field_definition_id] = match.field_option_value_id
        }
        return {
          quantity: String(r.quantity),
          price: String(r.price),
          max_completion_minutes: r.max_completion_minutes != null ? String(r.max_completion_minutes) : '',
          city_id: r.city_id ?? null,
          options: optionMap,
        }
      })
      setRows(loaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [])

  function selectProduct(pid: string | null) {
    const id = pid ?? ''
    setProductId(id)
    setRows([])
    setOptions([])
    if (id) loadProduct(id)
  }

  function addRow() {
    const defaults: Record<string, string> = {}
    for (const o of options) defaults[o.field_definition_id] = o.values[0]?.field_option_value_id ?? ''
    setRows((prev) => [...prev, { quantity: '', price: '', max_completion_minutes: '', city_id: null, options: defaults }])
  }

  function updateRow(i: number, patch: Partial<PricingRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function setRowOption(i: number, fieldDefId: string, valueId: string) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, options: { ...r.options, [fieldDefId]: valueId } } : r)))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        product_id: productId,
        rows: rows
          .filter((r) => r.quantity && r.price)
          .map((r) => ({
            quantity: Number(r.quantity),
            price: Number(r.price),
            max_completion_minutes: r.max_completion_minutes ? Number(r.max_completion_minutes) : null,
            city_id: r.city_id,
            option_value_ids: Object.values(r.options).filter(Boolean),
          })),
      }
      await api.post('/printer/pricing', payload)
      toast.success('Your pricing has been saved')
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
          Set the price you charge us per product, options and quantity. These are your own rates.
        </p>
      </div>

      <div className="max-w-sm">
        <Label className="text-xs">Product</Label>
        <Select value={productId} onValueChange={selectProduct}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a product you offer" />
          </SelectTrigger>
          <SelectContent>
            {offered.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : productId ? (
        <>
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No pricing rows yet. Add one below.</p>
            )}
            {rows.map((row, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {options.map((opt) => (
                    <div key={opt.field_definition_id} className="min-w-[140px]">
                      <Label className="text-xs">{opt.label}</Label>
                      <Select
                        value={row.options[opt.field_definition_id] ?? ''}
                        onValueChange={(v) => setRowOption(i, opt.field_definition_id, v ?? '')}
                      >
                        <SelectTrigger className="mt-1 h-9 text-sm">
                          <SelectValue placeholder={opt.label} />
                        </SelectTrigger>
                        <SelectContent>
                          {opt.values.map((v) => (
                            <SelectItem key={v.field_option_value_id} value={v.field_option_value_id}>{v.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <div className="min-w-[140px]">
                    <Label className="text-xs">City</Label>
                    <Select
                      value={row.city_id ?? '__all__'}
                      onValueChange={(v) => updateRow(i, { city_id: v === '__all__' ? null : v })}
                    >
                      <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Cities</SelectItem>
                        {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-28">
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" min={1} value={row.quantity} className="h-9 mt-1"
                      onChange={(e) => updateRow(i, { quantity: e.target.value })} />
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Your price (₹)</Label>
                    <Input type="number" min={0} step={0.01} value={row.price} className="h-9 mt-1"
                      onChange={(e) => updateRow(i, { price: e.target.value })} />
                  </div>
                  <div className="w-36">
                    <Label className="text-xs">Completion (min)</Label>
                    <Input type="number" min={0} value={row.max_completion_minutes} className="h-9 mt-1" placeholder="Optional"
                      onChange={(e) => updateRow(i, { max_completion_minutes: e.target.value })} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add pricing row
            </Button>
            <Button size="sm" onClick={save} disabled={saving || rows.length === 0}>
              {saving ? 'Saving…' : 'Save pricing'}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
