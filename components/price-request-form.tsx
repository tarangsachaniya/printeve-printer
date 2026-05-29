'use client'

import { useEffect, useState } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export interface PriceRequestPayload {
  product_id: string
  base_price: number
  paper_qualities: { gsm: number; price: number }[]
  paper_types: { type: string; price: number }[]
  quantity_tiers: { min_qty: number; max_qty: number | null; unit_price: number }[]
  notes: string | null
}

export interface PriceRequestInitial {
  base_price?: number
  paper_qualities?: { gsm: number; price: number }[]
  paper_types?: { type: string; price: number }[]
  quantity_tiers?: { min_qty: number; max_qty: number | null; unit_price: number }[]
  notes?: string | null
}

interface PaperQualityOption { id: string; gsm: number; label: string | null }
interface PaperTypeOption { id: string; name: string }

type Quality = { gsm: string; price: string }
type PaperTypeEntry = { type: string; price: string }
type QtyTier = { min_qty: string; max_qty: string; unit_price: string }

export function PriceRequestForm({
  productId,
  initial,
  readOnly = false,
  onSubmit,
  saving = false,
  formId = 'price-request-form',
  hideSubmit = false,
}: {
  productId: string
  initial?: PriceRequestInitial
  readOnly?: boolean
  onSubmit?: (data: PriceRequestPayload) => void | Promise<void>
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
}) {
  const [paperQualityOptions, setPaperQualityOptions] = useState<PaperQualityOption[]>([])
  const [paperTypeOptions, setPaperTypeOptions] = useState<PaperTypeOption[]>([])

  const [basePrice, setBasePrice] = useState(initial?.base_price != null ? String(initial.base_price) : '')
  const [qualities, setQualities] = useState<Quality[]>(
    (initial?.paper_qualities ?? []).map(q => ({ gsm: String(q.gsm), price: String(q.price) })),
  )
  const [paperTypes, setPaperTypes] = useState<PaperTypeEntry[]>(
    (initial?.paper_types ?? []).map(t => ({ type: t.type, price: String(t.price) })),
  )
  const [qtyTiers, setQtyTiers] = useState<QtyTier[]>(
    (initial?.quantity_tiers ?? []).map(t => ({
      min_qty: String(t.min_qty),
      max_qty: t.max_qty != null ? String(t.max_qty) : '',
      unit_price: String(t.unit_price),
    })),
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [pendingGsm, setPendingGsm] = useState('')
  const [pendingType, setPendingType] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<{ items: PaperQualityOption[] }>('/printer/paper/qualities'),
      api.get<{ items: PaperTypeOption[] }>('/printer/paper/types'),
    ]).then(([q, t]) => {
      setPaperQualityOptions(q.items ?? [])
      setPaperTypeOptions(t.items ?? [])
    }).catch(() => {})
  }, [])

  // re-sync when initial changes (e.g. loaded after mount)
  useEffect(() => {
    if (!initial) return
    if (initial.base_price != null) setBasePrice(String(initial.base_price))
    setQualities((initial.paper_qualities ?? []).map(q => ({ gsm: String(q.gsm), price: String(q.price) })))
    setPaperTypes((initial.paper_types ?? []).map(t => ({ type: t.type, price: String(t.price) })))
    setQtyTiers((initial.quantity_tiers ?? []).map(t => ({
      min_qty: String(t.min_qty),
      max_qty: t.max_qty != null ? String(t.max_qty) : '',
      unit_price: String(t.unit_price),
    })))
    setNotes(initial.notes ?? '')
  }, [initial])

  const availableQualities = paperQualityOptions.filter(q => !qualities.some(x => x.gsm === String(q.gsm)))
  const availableTypes = paperTypeOptions.filter(t => !paperTypes.some(x => x.type === t.name))

  function qualityDisplay(gsm: string) {
    const opt = paperQualityOptions.find(q => String(q.gsm) === gsm)
    return opt?.label ? `${gsm} gsm — ${opt.label}` : `${gsm} gsm`
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!onSubmit || readOnly) return
    onSubmit({
      product_id: productId,
      base_price: Number(basePrice),
      paper_qualities: qualities.map(q => ({ gsm: Number(q.gsm), price: Number(q.price) })),
      paper_types: paperTypes.map(t => ({ type: t.type, price: Number(t.price) })),
      quantity_tiers: qtyTiers.map(t => ({
        min_qty: Number(t.min_qty),
        max_qty: t.max_qty ? Number(t.max_qty) : null,
        unit_price: Number(t.unit_price),
      })),
      notes: notes.trim() || null,
    })
  }

  const disabled = readOnly || saving

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-7">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base price</p>
        <div className="space-y-1.5">
          <Label>Proposed base price (₹) *</Label>
          <Input
            type="number"
            value={basePrice}
            onChange={e => setBasePrice(e.target.value)}
            disabled={disabled}
            required
            min={0}
          />
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper quality (GSM)</p>
        {!readOnly && availableQualities.length > 0 && (
          <div className="flex gap-2">
            <Select value={pendingGsm || undefined} onValueChange={v => setPendingGsm(v ?? '')}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Add GSM…" /></SelectTrigger>
              <SelectContent>
                {availableQualities.map(q => (
                  <SelectItem key={q.id} value={String(q.gsm)}>
                    {q.gsm} gsm{q.label ? ` — ${q.label}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="icon"
              disabled={!pendingGsm}
              onClick={() => {
                if (!pendingGsm) return
                setQualities(p => [...p, { gsm: pendingGsm, price: '' }])
                setPendingGsm('')
              }}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
        {qualities.length > 0 ? (
          <div className="rounded-md border divide-y">
            {qualities.map((q, i) => (
              <div key={q.gsm} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm font-medium w-36 shrink-0">{qualityDisplay(q.gsm)}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number" className="pl-7" value={q.price}
                    disabled={readOnly}
                    onChange={e => setQualities(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                  />
                </div>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQualities(p => p.filter((_, j) => j !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None</p>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper type</p>
        {!readOnly && availableTypes.length > 0 && (
          <div className="flex gap-2">
            <Select value={pendingType || undefined} onValueChange={v => setPendingType(v ?? '')}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Add type…" /></SelectTrigger>
              <SelectContent>
                {availableTypes.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="icon"
              disabled={!pendingType}
              onClick={() => {
                if (!pendingType) return
                setPaperTypes(p => [...p, { type: pendingType, price: '' }])
                setPendingType('')
              }}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
        {paperTypes.length > 0 ? (
          <div className="rounded-md border divide-y">
            {paperTypes.map((t, i) => (
              <div key={t.type} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm font-medium w-24 shrink-0">{t.type}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input
                    type="number" className="pl-7" value={t.price}
                    disabled={readOnly}
                    onChange={e => setPaperTypes(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                  />
                </div>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPaperTypes(p => p.filter((_, j) => j !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity tiers</p>
          {!readOnly && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setQtyTiers(p => [...p, { min_qty: '', max_qty: '', unit_price: '' }])}
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add tier
            </Button>
          )}
        </div>
        {qtyTiers.length > 0 ? (
          readOnly ? (
            <div className="flex flex-wrap gap-2">
              {qtyTiers.map((tier, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm font-medium"
                >
                  <span className="text-muted-foreground text-xs">qty</span>
                  {tier.min_qty}
                  <span className="text-muted-foreground">–</span>
                  {tier.max_qty || '∞'}
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>₹{tier.unit_price}/unit</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-0 bg-muted/50 border-b">
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Min qty</span>
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Max qty</span>
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Unit price (₹)</span>
                <span />
              </div>
              {qtyTiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_2rem] gap-0 border-t first:border-t-0 items-center">
                  <div className="px-2 py-1.5">
                    <Input
                      type="number" placeholder="e.g. 1" value={tier.min_qty}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                      onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, min_qty: e.target.value } : x))}
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l">
                    <Input
                      type="number" placeholder="∞ if blank" value={tier.max_qty}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                      onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, max_qty: e.target.value } : x))}
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">₹</span>
                    <Input
                      type="number" placeholder="0.00" value={tier.unit_price}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 pl-5 pr-1"
                      onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))}
                    />
                  </div>
                  <div className="flex items-center justify-center border-l">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQtyTiers(p => p.filter((_, j) => j !== i))}>
                      <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">None</p>
        )}
      </section>

      <section className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason / notes</p>
        <textarea
          className="w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          value={notes}
          disabled={disabled}
          onChange={e => setNotes(e.target.value)}
          placeholder="Explain why you're requesting this price change…"
        />
      </section>

      {onSubmit && !readOnly && !hideSubmit && (
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Submitting…' : 'Submit for review'}
        </Button>
      )}
    </form>
  )
}
