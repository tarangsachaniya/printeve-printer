'use client'

import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { InfoTooltip } from '@/components/ui/info-tooltip'

export interface VariantOptionEntry { id: string; price_modifier: number }
export interface QuantitySlabEntry {
  min_qty: number
  max_qty: number | null
  price_modifier: number
  max_completion_minutes: number | null
}

export interface PriceRequestPayload {
  product_id: string
  base_price: number
  paper_sizes: { paper_size_id: string; price_modifier: number }[]
  paper_qualities: { paper_quality_id: string; price_modifier: number }[]
  paper_types: { paper_type_id: string; price_modifier: number }[]
  quantity_slabs: QuantitySlabEntry[]
  notes: string | null
}

export interface PriceRequestInitial {
  base_price?: number
  paper_sizes?: { paper_size_id: string; price_modifier: number; name?: string }[]
  paper_qualities?: { paper_quality_id: string; price_modifier: number; name?: string }[]
  paper_types?: { paper_type_id: string; price_modifier: number; name?: string }[]
  quantity_slabs?: QuantitySlabEntry[]
  notes?: string | null
}

interface PaperSize { id: string; name: string }
interface PaperQuality { id: string; name: string }
interface PaperTypeOption { id: string; name: string }

type OptionEntry = { id: string; name: string; price_modifier: string }
type QtySlab = { min_qty: string; max_qty: string; price_modifier: string; max_completion_minutes: string }

function toQtySlabs(slabs?: QuantitySlabEntry[]): QtySlab[] {
  return (slabs ?? []).map(s => ({
    min_qty: String(s.min_qty),
    max_qty: s.max_qty != null ? String(s.max_qty) : '',
    price_modifier: String(s.price_modifier),
    max_completion_minutes: s.max_completion_minutes != null ? String(s.max_completion_minutes) : '',
  }))
}

function VariantOptionSection({
  title, description, readOnly, entries, setEntries, available, pending, setPending, placeholder,
}: {
  title: string
  description?: string
  readOnly: boolean
  entries: OptionEntry[]
  setEntries: React.Dispatch<React.SetStateAction<OptionEntry[]>>
  available: { id: string; name: string }[]
  pending: string
  setPending: (v: string) => void
  placeholder: string
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {description && <InfoTooltip text={description} />}
      </div>
      {!readOnly && available.length > 0 && (
        <Combobox
          options={available.map(o => ({ value: o.id, label: o.name }))}
          value={pending}
          onValueChange={v => {
            const opt = available.find(o => o.id === v)
            if (!opt || entries.some(e => e.id === opt.id)) return
            setEntries(p => [...p, { id: opt.id, name: opt.name, price_modifier: '' }])
            setPending('')
          }}
          placeholder={placeholder}
          searchPlaceholder="Search…"
        />
      )}
      {entries.length > 0 ? (
        <div className="rounded-md border divide-y">
          {entries.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-sm font-medium w-28 shrink-0 truncate">{e.name}</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+/- ₹</span>
                <Input type="number" className="pl-12" value={e.price_modifier} disabled={readOnly}
                  onChange={ev => setEntries(p => p.map((x, j) => j === i ? { ...x, price_modifier: ev.target.value } : x))} />
              </div>
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEntries(p => p.filter((_, j) => j !== i))}>
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
  )
}

export function PriceRequestForm({
  productId,
  initial,
  readOnly = false,
  onSubmit,
  saving = false,
  formId = 'price-request-form',
  hideSubmit = false,
  paperSizes = [],
  paperQualities: paperQualitiesRaw = [],
  paperTypes: paperTypeOptions = [],
}: {
  productId: string
  initial?: PriceRequestInitial
  readOnly?: boolean
  onSubmit?: (data: PriceRequestPayload) => void | Promise<void>
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
  paperSizes?: PaperSize[]
  paperQualities?: { id: string; gsm: number; label: string | null }[]
  paperTypes?: PaperTypeOption[]
}) {
  const paperQualities = useMemo<PaperQuality[]>(() => paperQualitiesRaw.map(q => ({
    id: q.id,
    name: q.label ? `${q.gsm} GSM (${q.label})` : `${q.gsm} GSM`,
  })), [paperQualitiesRaw])

  const [basePrice, setBasePrice] = useState(initial?.base_price != null ? String(initial.base_price) : '')
  const [paperSizesSel, setPaperSizesSel] = useState<OptionEntry[]>(
    (initial?.paper_sizes ?? []).map(s => ({ id: s.paper_size_id, name: s.name ?? '', price_modifier: String(s.price_modifier) })),
  )
  const [paperQualitiesSel, setPaperQualitiesSel] = useState<OptionEntry[]>(
    (initial?.paper_qualities ?? []).map(q => ({ id: q.paper_quality_id, name: q.name ?? '', price_modifier: String(q.price_modifier) })),
  )
  const [paperTypesSel, setPaperTypesSel] = useState<OptionEntry[]>(
    (initial?.paper_types ?? []).map(t => ({ id: t.paper_type_id, name: t.name ?? '', price_modifier: String(t.price_modifier) })),
  )
  const [qtySlabs, setQtySlabs] = useState<QtySlab[]>(toQtySlabs(initial?.quantity_slabs))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [pendingSize, setPendingSize] = useState('')
  const [pendingQuality, setPendingQuality] = useState('')
  const [pendingType, setPendingType] = useState('')

  // re-sync when initial changes (e.g. loaded after mount)
  useEffect(() => {
    if (!initial) return
    if (initial.base_price != null) setBasePrice(String(initial.base_price))
    setPaperSizesSel((initial.paper_sizes ?? []).map(s => ({ id: s.paper_size_id, name: s.name ?? '', price_modifier: String(s.price_modifier) })))
    setPaperQualitiesSel((initial.paper_qualities ?? []).map(q => ({ id: q.paper_quality_id, name: q.name ?? '', price_modifier: String(q.price_modifier) })))
    setPaperTypesSel((initial.paper_types ?? []).map(t => ({ id: t.paper_type_id, name: t.name ?? '', price_modifier: String(t.price_modifier) })))
    setQtySlabs(toQtySlabs(initial.quantity_slabs))
    setNotes(initial.notes ?? '')
  }, [initial])

  const availableSizes = paperSizes.filter(s => !paperSizesSel.some(x => x.id === s.id))
  const availableQualities = paperQualities.filter(q => !paperQualitiesSel.some(x => x.id === q.id))
  const availableTypes = paperTypeOptions.filter(t => !paperTypesSel.some(x => x.id === t.id))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!onSubmit || readOnly) return
    onSubmit({
      product_id: productId,
      base_price: Number(basePrice),
      paper_sizes: paperSizesSel.map(s => ({ paper_size_id: s.id, price_modifier: Number(s.price_modifier) || 0 })),
      paper_qualities: paperQualitiesSel.map(q => ({ paper_quality_id: q.id, price_modifier: Number(q.price_modifier) || 0 })),
      paper_types: paperTypesSel.map(t => ({ paper_type_id: t.id, price_modifier: Number(t.price_modifier) || 0 })),
      quantity_slabs: qtySlabs.map(s => ({
        min_qty: Number(s.min_qty),
        max_qty: s.max_qty ? Number(s.max_qty) : null,
        price_modifier: Number(s.price_modifier) || 0,
        max_completion_minutes: s.max_completion_minutes ? Number(s.max_completion_minutes) : null,
      })),
      notes: notes.trim() || null,
    })
  }

  const disabled = readOnly || saving

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-7">
      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base price</p>
          <InfoTooltip text="The base price per unit before any size, quality, or quantity adjustments are applied." />
        </div>
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

      <VariantOptionSection
        title="Paper sizes"
        description="Select the paper sizes this product can be printed in. For each size, enter how much to add (+) or subtract (-) from the base price per unit. Leave blank or enter 0 if the size has no extra charge."
        readOnly={readOnly}
        entries={paperSizesSel}
        setEntries={setPaperSizesSel}
        available={availableSizes}
        pending={pendingSize}
        setPending={setPendingSize}
        placeholder="Add size…"
      />

      <VariantOptionSection
        title="Paper Quality"
        description="Select the paper quality (GSM / finish) options for this product. Enter how much to add (+) or subtract (-) from the base price per unit for each quality. Leave blank or enter 0 for no extra charge."
        readOnly={readOnly}
        entries={paperQualitiesSel}
        setEntries={setPaperQualitiesSel}
        available={availableQualities}
        pending={pendingQuality}
        setPending={setPendingQuality}
        placeholder="Add quality…"
      />

      <VariantOptionSection
        title="Paper type"
        description="Select the paper types (e.g. Glossy, Matte, Kraft) available for this product. Enter how much to add (+) or subtract (-) from the base price per unit for each type. Leave blank or enter 0 for no extra charge."
        readOnly={readOnly}
        entries={paperTypesSel}
        setEntries={setPaperTypesSel}
        available={availableTypes}
        pending={pendingType}
        setPending={setPendingType}
        placeholder="Add type…"
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity slabs</p>
            <InfoTooltip text="Set price adjustments based on order quantity. For each range, enter how much to add (+) or subtract (-) per unit from the base price. Also set the maximum time (in minutes) to fulfill orders in that range. Leave Max Qty blank for open-ended slabs (e.g. 100+)." />
          </div>
          {!readOnly && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setQtySlabs(p => [...p, { min_qty: '', max_qty: '', price_modifier: '', max_completion_minutes: '' }])}
            >
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add slab
            </Button>
          )}
        </div>
        {qtySlabs.length > 0 ? (
          readOnly ? (
            <div className="flex flex-wrap gap-2">
              {qtySlabs.map((slab, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm font-medium"
                >
                  <span className="text-muted-foreground text-xs">qty</span>
                  {slab.min_qty}
                  <span className="text-muted-foreground">–</span>
                  {slab.max_qty || '∞'}
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span>{Number(slab.price_modifier) >= 0 ? '+' : ''}₹{slab.price_modifier} modifier</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-0 bg-muted/50 border-b">
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Min qty</span>
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Max qty</span>
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Price modifier (₹)</span>
                <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Completion (min)</span>
                <span />
              </div>
              {qtySlabs.map((slab, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-0 border-t first:border-t-0 items-center">
                  <div className="px-2 py-1.5">
                    <Input
                      type="number" placeholder="e.g. 1" value={slab.min_qty}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                      onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, min_qty: e.target.value } : x))}
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l">
                    <Input
                      type="number" placeholder="∞ if blank" value={slab.max_qty}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                      onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, max_qty: e.target.value } : x))}
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">+/- ₹</span>
                    <Input
                      type="number" placeholder="0.00" value={slab.price_modifier}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 pl-10 pr-1"
                      onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, price_modifier: e.target.value } : x))}
                    />
                  </div>
                  <div className="px-2 py-1.5 border-l">
                    <Input
                      type="number" placeholder="optional" value={slab.max_completion_minutes}
                      className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
                      onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, max_completion_minutes: e.target.value } : x))}
                    />
                  </div>
                  <div className="flex items-center justify-center border-l">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQtySlabs(p => p.filter((_, j) => j !== i))}>
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
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason / notes</p>
          <InfoTooltip text="Explain why you're requesting this price change. This note is shared with the admin reviewing your request." />
        </div>
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
