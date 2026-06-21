'use client'

import { useEffect, useState } from 'react'
import { PlusIcon, XIcon, ChevronDownIcon, ChevronRight, UploadIcon, Trash2, WandSparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''

function toWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('WebP conversion failed')), 'image/webp', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) throw new Error('Cloudinary is not configured')
  const fd = new FormData()
  const webp = await toWebP(file)
  fd.append('file', webp, file.name.replace(/\.[^.]+$/, '.webp'))
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'printEve/products')
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd })
  const data = await res.json() as { secure_url?: string; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Cloudinary upload failed')
  return data.secure_url!
}

export interface FieldOptionValueCatalog { id: string; value: string; sort_order: number }
export interface FieldDefCatalog {
  id: string
  key: string
  label: string
  field_type: 'select' | 'multi_select' | 'boolean' | 'number' | 'text' | 'textarea' | 'file_upload' | 'radio'
  field_option_values: FieldOptionValueCatalog[]
}

interface OptionEntry {
  field_definition_id: string
  sort_order: number
  is_required: boolean
  value_ids: string[]
}

interface PricingTier {
  quantity: string
  price: string
  max_completion_minutes: string
}

interface PricingGroup {
  option_value_ids: string[]
  city_id: string | null
  tiers: PricingTier[]
  collapsed: boolean
}

export interface PriceRequestPayload {
  product_id: string
  options: { field_definition_id: string; sort_order: number; is_required: boolean; value_ids: string[] }[]
  pricing_matrix: { quantity: number; price: number; max_completion_minutes: number | null; option_value_ids: string[]; city_id: string | null }[]
  notes: string | null
}

interface CurrentProductOption {
  id: string
  field_definition_id: string
  key: string
  label: string
  field_type: string
  is_required: boolean
  sort_order: number
  values: { id: string; field_option_value_id: string; value: string; is_default: boolean }[]
}

interface CurrentPricingMatrixEntry {
  id: string
  quantity: number
  price: number
  max_completion_minutes: number | null
  option_value_ids: string[]
  city_id: string | null
}

export interface PriceRequestInitial {
  options?: { field_definition_id: string; sort_order?: number; is_required?: boolean; value_ids?: string[] }[]
  pricing_matrix?: { quantity: number; price: number; max_completion_minutes: number | null; option_value_ids: string[]; city_id: string | null }[]
  notes?: string | null
  // Current product config for comparison
  current_options?: CurrentProductOption[]
  current_pricing_matrix?: CurrentPricingMatrixEntry[]
  faqs?: { question: string; answer: string }[]
  finish_and_care?: string[]
  guidelines?: { icon_url: string; title: string; description: string }[]
  specifications?: { key: string; value: string }[]
}

const OPTION_FIELD_TYPES = new Set(['select', 'multi_select', 'boolean', 'radio'])

const FIELD_TYPES = [
  { value: 'select',       label: 'Dropdown (select)' },
  { value: 'radio',        label: 'Radio buttons' },
  { value: 'multi_select', label: 'Multi-select checkboxes' },
  { value: 'boolean',      label: 'Yes / No (boolean)' },
  { value: 'text',         label: 'Text input' },
  { value: 'number',       label: 'Number input' },
  { value: 'textarea',     label: 'Text area' },
  { value: 'file_upload',  label: 'File upload' },
]

function PriceFieldOptionCreator({ fieldDefId, onCreated }: {
  fieldDefId: string
  onCreated: (opt: { id: string; value: string; sort_order: number }) => void
}) {
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!value.trim()) return
    setCreating(true)
    try {
      const res = await api.post<{ data: { id: string; value: string; sort_order: number } }>(
        `/printer/field-definitions/${fieldDefId}/options`, { value: value.trim() }
      )
      onCreated(res.data)
      setValue('')
      toast.success(`Option "${value.trim()}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create option')
    } finally { setCreating(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="New option value"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
        className="flex-1"
      />
      <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={creating || !value.trim()}>
        <PlusIcon className="h-3.5 w-3.5 mr-1" /> {creating ? '...' : 'Create'}
      </Button>
    </div>
  )
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap(a => arr.map(v => [...a, v])), [[]])
}

export function PriceRequestForm({
  productId,
  initial,
  readOnly = false,
  onSubmit,
  saving = false,
  formId = 'price-request-form',
  hideSubmit = false,
  fieldCatalog: fieldCatalogProp = [],
  cities = [],
}: {
  productId: string
  initial?: PriceRequestInitial
  readOnly?: boolean
  onSubmit?: (data: PriceRequestPayload) => void | Promise<void>
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
  fieldCatalog?: FieldDefCatalog[]
  cities?: { id: string; name: string; state: string }[]
}) {
  // --- dynamic options ---
  const [fieldCatalog, setFieldCatalog] = useState<FieldDefCatalog[]>(fieldCatalogProp)
  const [selectedOptions, setSelectedOptions] = useState<OptionEntry[]>([])
  const [pendingFieldId, setPendingFieldId] = useState('')
  const [creatingField, setCreatingField] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('select')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [savingField, setSavingField] = useState(false)

  // --- pricing groups ---
  const [pricingGroups, setPricingGroups] = useState<PricingGroup[]>([])
  const [notes, setNotes] = useState(initial?.notes ?? '')

  // --- content sections ---
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(initial?.faqs ?? [])
  const [finishAndCare, setFinishAndCare] = useState<string[]>(initial?.finish_and_care ?? [])
  const [guidelinesArr, setGuidelinesArr] = useState<{ icon_url: string; title: string; description: string }[]>(initial?.guidelines ?? [])
  const [specifications, setSpecifications] = useState<{ key: string; value: string }[]>(initial?.specifications ?? [])
  const [uploadingGuidelineIcon, setUploadingGuidelineIcon] = useState<number | null>(null)

  useEffect(() => { setFieldCatalog(fieldCatalogProp) }, [fieldCatalogProp])

  // re-sync when initial changes
  useEffect(() => {
    if (!initial) return
    const initOpts = initial.options ?? []
    setSelectedOptions(initOpts.map((o, i) => ({
      field_definition_id: o.field_definition_id,
      sort_order: o.sort_order ?? i,
      is_required: o.is_required ?? false,
      value_ids: o.value_ids ?? [],
    })))
    // Group flat pricing_matrix rows by (option_value_ids + city_id) into PricingGroup[]
    const initMatrix = initial.pricing_matrix ?? []
    if (initMatrix.length > 0) {
      const groupMap = new Map<string, PricingGroup>()
      for (const pm of initMatrix) {
        const key = JSON.stringify([...(pm.option_value_ids ?? []).slice().sort(), pm.city_id ?? null])
        const existing = groupMap.get(key)
        const tier: PricingTier = {
          quantity: String(pm.quantity),
          price: String(pm.price),
          max_completion_minutes: pm.max_completion_minutes != null ? String(pm.max_completion_minutes) : '',
        }
        if (existing) {
          existing.tiers.push(tier)
        } else {
          groupMap.set(key, {
            option_value_ids: pm.option_value_ids ?? [],
            city_id: pm.city_id ?? null,
            tiers: [tier],
            collapsed: false,
          })
        }
      }
      setPricingGroups(Array.from(groupMap.values()))
    } else {
      setPricingGroups([])
    }
    setNotes(initial.notes ?? '')
    setFaqs(initial.faqs ?? [])
    setFinishAndCare(initial.finish_and_care ?? [])
    setGuidelinesArr(initial.guidelines ?? [])
    setSpecifications(initial.specifications ?? [])
  }, [initial])

  const availableFieldDefs = fieldCatalog.filter(fd =>
    !selectedOptions.some(o => o.field_definition_id === fd.id)
  )

  function addFieldFromCatalog(def: FieldDefCatalog) {
    if (selectedOptions.some(o => o.field_definition_id === def.id)) return
    const valueIds = OPTION_FIELD_TYPES.has(def.field_type)
      ? def.field_option_values.slice().sort((a, b) => a.sort_order - b.sort_order).map(ov => ov.id)
      : []
    setSelectedOptions(prev => [...prev, {
      field_definition_id: def.id,
      sort_order: prev.length,
      is_required: false,
      value_ids: valueIds,
    }])
  }

  function toggleValueId(optIndex: number, fovId: string) {
    setSelectedOptions(prev => prev.map((opt, i) => {
      if (i !== optIndex) return opt
      const has = opt.value_ids.includes(fovId)
      return { ...opt, value_ids: has ? opt.value_ids.filter(v => v !== fovId) : [...opt.value_ids, fovId] }
    }))
  }

  async function handleCreateField() {
    if (!newFieldKey.trim() || !newFieldLabel.trim()) {
      toast.error('Key and label are required')
      return
    }
    setSavingField(true)
    try {
      const hasOptions = OPTION_FIELD_TYPES.has(newFieldType)
      const options = hasOptions
        ? newFieldOptions.split('\n').map(s => s.trim()).filter(Boolean)
        : []
      const res = await api.post<{ data: FieldDefCatalog & { id: string } }>('/printer/field-definitions', {
        key: newFieldKey.trim(),
        label: newFieldLabel.trim(),
        field_type: newFieldType,
        options,
      })
      const newDef: FieldDefCatalog = {
        ...res.data,
        field_option_values: (res.data as any).field_option_values ?? [],
      }
      setFieldCatalog(prev => [...prev, newDef])
      addFieldFromCatalog(newDef)
      setCreatingField(false)
      setNewFieldKey('')
      setNewFieldLabel('')
      setNewFieldType('select')
      setNewFieldOptions('')
      toast.success('Field type created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create field type')
    } finally {
      setSavingField(false)
    }
  }

  /* ── Pricing Group helpers ── */

  function getFieldDef(fieldDefId: string) {
    return fieldCatalog.find(d => d.id === fieldDefId)
  }

  function addPricingGroup() {
    const defaultValueIds = selectedOptions
      .filter(o => {
        const def = getFieldDef(o.field_definition_id)
        return def && OPTION_FIELD_TYPES.has(def.field_type)
      })
      .map(o => o.value_ids[0] ?? '')
      .filter(Boolean)
    setPricingGroups(prev => [...prev, {
      option_value_ids: defaultValueIds,
      city_id: null,
      tiers: [{ quantity: '', price: '', max_completion_minutes: '' }],
      collapsed: false,
    }])
  }

  function removePricingGroup(i: number) {
    setPricingGroups(prev => prev.filter((_, j) => j !== i))
  }

  function updateGroupOptionValue(groupIdx: number, fieldDefId: string, newValueId: string) {
    setPricingGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g
      const fd = getFieldDef(fieldDefId)
      if (!fd) return g
      const allValuesForField = new Set(fd.field_option_values.map(v => v.id))
      const filtered = g.option_value_ids.filter(id => !allValuesForField.has(id))
      return { ...g, option_value_ids: [...filtered, newValueId] }
    }))
  }

  function updateGroupCity(groupIdx: number, cityId: string | null) {
    setPricingGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, city_id: cityId } : g))
  }

  function addTier(groupIdx: number) {
    setPricingGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, tiers: [...g.tiers, { quantity: '', price: '', max_completion_minutes: '' }] } : g
    ))
  }

  function removeTier(groupIdx: number, tierIdx: number) {
    setPricingGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, tiers: g.tiers.filter((_, j) => j !== tierIdx) } : g
    ))
  }

  function updateTier(groupIdx: number, tierIdx: number, field: keyof PricingTier, value: string) {
    setPricingGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, tiers: g.tiers.map((t, j) => j === tierIdx ? { ...t, [field]: value } : t) } : g
    ))
  }

  function toggleGroupCollapse(i: number) {
    setPricingGroups(prev => prev.map((g, j) => j === i ? { ...g, collapsed: !g.collapsed } : g))
  }

  function generateAllCombinations() {
    const optionArrays = selectedOptions
      .filter(o => {
        const def = getFieldDef(o.field_definition_id)
        return def && OPTION_FIELD_TYPES.has(def.field_type)
      })
      .map(o => {
        const fd = getFieldDef(o.field_definition_id)
        return o.value_ids.map(vid => {
          const fov = fd?.field_option_values.find(v => v.id === vid)
          return { id: vid, label: fov?.value ?? vid }
        })
      })
      .filter(a => a.length > 0)

    if (optionArrays.length === 0) {
      toast.error('Add at least one product option with values first')
      return
    }

    const combos = cartesian(optionArrays)

    const newGroups: PricingGroup[] = combos.map(combo => ({
      option_value_ids: combo.map(v => v.id),
      city_id: null,
      tiers: [{ quantity: '', price: '', max_completion_minutes: '' }],
      collapsed: false,
    }))

    setPricingGroups(prev => [...prev, ...newGroups])
    toast.success(`Generated ${newGroups.length} pricing groups`)
  }

  function getGroupLabel(group: PricingGroup): string {
    const parts: string[] = []
    for (const o of selectedOptions) {
      const fd = getFieldDef(o.field_definition_id)
      if (!fd || !OPTION_FIELD_TYPES.has(fd.field_type)) continue
      const allValuesForField = new Set(fd.field_option_values.map(v => v.id))
      const selectedId = group.option_value_ids.find(id => allValuesForField.has(id))
      const fov = fd.field_option_values.find(v => v.id === selectedId)
      if (fov) parts.push(fov.value)
    }
    if (group.city_id) {
      const city = cities.find(c => c.id === group.city_id)
      if (city) parts.push(city.name)
    } else {
      parts.push('All Cities')
    }
    return parts.join(' · ') || 'New Group'
  }

  function getSelectedValueForField(group: PricingGroup, fieldDefId: string): string {
    const fd = getFieldDef(fieldDefId)
    if (!fd) return ''
    const allValuesForField = new Set(fd.field_option_values.map(v => v.id))
    return group.option_value_ids.find(id => allValuesForField.has(id)) ?? ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!onSubmit || readOnly) return
    onSubmit({
      product_id: productId,
      options: selectedOptions.map((o, i) => ({
        field_definition_id: o.field_definition_id,
        sort_order: i,
        is_required: o.is_required,
        value_ids: o.value_ids,
      })),
      pricing_matrix: pricingGroups.flatMap(group =>
        group.tiers
          .filter(t => t.quantity && t.price)
          .map(t => ({
            quantity: Number(t.quantity),
            price: Number(t.price),
            max_completion_minutes: t.max_completion_minutes ? Number(t.max_completion_minutes) : null,
            option_value_ids: group.option_value_ids,
            city_id: group.city_id || null,
          }))
      ),
      notes: notes.trim() || null,
    })
  }

  const disabled = readOnly || saving

  // Current config for comparison display
  const currentOptions = initial?.current_options ?? []
  const currentMatrix = initial?.current_pricing_matrix ?? []

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-7">

      {/* Current configuration (read-only comparison) */}
      {(currentOptions.length > 0 || currentMatrix.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current configuration</p>
            <InfoTooltip text="This shows the product's current options and pricing matrix for reference." />
          </div>
          {currentOptions.length > 0 && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Current options:</p>
              {currentOptions.map(opt => (
                <div key={opt.id} className="text-sm">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground"> ({opt.field_type})</span>
                  {opt.values.length > 0 && (
                    <span className="text-muted-foreground">
                      {' — '}
                      {opt.values.map(v => v.value).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {currentMatrix.length > 0 && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Current pricing matrix:</p>
              <div className="rounded-md border overflow-hidden bg-background">
                <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr] gap-0 bg-muted/50 border-b">
                  <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Qty</span>
                  <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Price</span>
                  <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Completion</span>
                  <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">Options</span>
                  <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-l">City</span>
                </div>
                {currentMatrix.map((pm, i) => (
                  <div key={pm.id ?? i} className="grid grid-cols-[1fr_1fr_1fr_1.5fr_1fr] gap-0 border-t first:border-t-0 text-sm">
                    <span className="px-3 py-1.5">{pm.quantity}</span>
                    <span className="px-3 py-1.5 border-l">{'₹'}{pm.price}</span>
                    <span className="px-3 py-1.5 border-l text-muted-foreground">{pm.max_completion_minutes != null ? `${pm.max_completion_minutes} min` : '—'}</span>
                    <span className="px-3 py-1.5 border-l text-xs text-muted-foreground">
                      {pm.option_value_ids.length > 0
                        ? pm.option_value_ids.map(vid => {
                            // Try to find label from current options
                            for (const opt of currentOptions) {
                              const val = opt.values.find(v => v.field_option_value_id === vid)
                              if (val) return val.value
                            }
                            return vid.slice(0, 8)
                          }).join(', ')
                        : 'Base'
                      }
                    </span>
                    <span className="px-3 py-1.5 border-l text-xs text-muted-foreground">
                      {pm.city_id
                        ? (cities.find(c => c.id === pm.city_id)?.name ?? pm.city_id.slice(0, 8))
                        : 'All Cities'
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Proposed options */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed options</p>
          <InfoTooltip text="Configure which options and values should be available for this product. Pick from the catalog or create a new field type." />
        </div>

        {!readOnly && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  options={availableFieldDefs.map(d => ({ value: d.id, label: `${d.label} (${d.field_type})` }))}
                  value={pendingFieldId}
                  onValueChange={v => {
                    const def = fieldCatalog.find(d => d.id === v)
                    if (!def) return
                    addFieldFromCatalog(def)
                    setPendingFieldId('')
                  }}
                  placeholder="Add option from catalog…"
                  searchPlaceholder="Search field types…"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatingField(v => !v)}
                className="shrink-0"
              >
                <PlusIcon className="h-3.5 w-3.5 mr-1" />
                New type
                <ChevronDownIcon className={`h-3 w-3 ml-1 transition-transform ${creatingField ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {creatingField && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Create new field type</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Key (internal ID) *</Label>
                    <Input
                      placeholder="e.g. finishing_type"
                      value={newFieldKey}
                      onChange={e => setNewFieldKey(e.target.value)}
                      disabled={savingField}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label (shown to customers) *</Label>
                    <Input
                      placeholder="e.g. Finishing Type"
                      value={newFieldLabel}
                      onChange={e => setNewFieldLabel(e.target.value)}
                      disabled={savingField}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Field type *</Label>
                  <select
                    value={newFieldType}
                    onChange={e => setNewFieldType(e.target.value)}
                    disabled={savingField}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {FIELD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {OPTION_FIELD_TYPES.has(newFieldType) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Options (one per line) *</Label>
                    <textarea
                      placeholder={'Glossy\nMatte\nKraft'}
                      value={newFieldOptions}
                      onChange={e => setNewFieldOptions(e.target.value)}
                      disabled={savingField}
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingField(false)} disabled={savingField}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateField} disabled={savingField}>
                    {savingField ? 'Creating…' : 'Create & add'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedOptions.length > 0 ? (
          <div className="rounded-md border divide-y">
            {selectedOptions.map((opt, i) => {
              const def = fieldCatalog.find(d => d.id === opt.field_definition_id)
              const label = def?.label ?? opt.field_definition_id
              const hasOptionValues = def && OPTION_FIELD_TYPES.has(def.field_type)
              return (
                <div key={opt.field_definition_id} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">{label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {def?.field_type ?? 'unknown'}
                    </span>
                    {!readOnly && (
                      <>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={opt.is_required}
                            onChange={e => setSelectedOptions(p => p.map((o, j) => j === i ? { ...o, is_required: e.target.checked } : o))}
                            className="rounded"
                          />
                          Required
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSelectedOptions(p => p.filter((_, j) => j !== i))}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {readOnly && opt.is_required && (
                      <span className="text-xs text-destructive">required</span>
                    )}
                  </div>

                  {hasOptionValues && def.field_option_values.length > 0 && (
                    <div className="ml-4 space-y-1">
                      <p className="text-xs text-muted-foreground mb-1">Available values:</p>
                      {def.field_option_values
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(ov => {
                          const isSelected = opt.value_ids.includes(ov.id)
                          return (
                            <label key={ov.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={readOnly}
                                onChange={() => toggleValueId(i, ov.id)}
                                className="rounded"
                              />
                              <span>{ov.value}</span>
                            </label>
                          )
                        })}
                      {!readOnly && (
                        <PriceFieldOptionCreator
                          fieldDefId={opt.field_definition_id}
                          onCreated={(newOpt) => {
                            setFieldCatalog(prev => prev.map(fd =>
                              fd.id === opt.field_definition_id
                                ? { ...fd, field_option_values: [...fd.field_option_values, newOpt] }
                                : fd
                            ))
                            setSelectedOptions(prev => prev.map((o, j) =>
                              j === i ? { ...o, value_ids: [...o.value_ids, newOpt.id] } : o
                            ))
                          }}
                        />
                      )}
                    </div>
                  )}

                  {readOnly && !hasOptionValues && (
                    <p className="ml-4 text-xs text-muted-foreground">Customer input — no selectable values</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'No options configured.' : 'No options added yet — pick from the catalog or create a new type above.'}
          </p>
        )}
      </section>

      {/* Proposed pricing matrix — grouped UI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed pricing matrix</p>
            <InfoTooltip text="Each group represents one option combination (+ optional city). Add quantity / price tiers within each group." />
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addPricingGroup}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Pricing Group
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={generateAllCombinations}>
              <WandSparklesIcon className="h-3.5 w-3.5 mr-1" /> Generate All Combinations
            </Button>
          </div>
        )}

        {pricingGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'No pricing defined.' : 'No pricing groups yet.'}
          </p>
        )}

        {pricingGroups.map((group, gi) => (
          <div key={gi} className="rounded-md border">
            {/* Group header */}
            <div
              className="flex items-center gap-2 px-4 py-3 bg-muted/30 cursor-pointer"
              onClick={() => toggleGroupCollapse(gi)}
            >
              {group.collapsed
                ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                : <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
              }
              <span className="text-sm font-medium flex-1">{getGroupLabel(group)}</span>
              <span className="text-xs text-muted-foreground">{group.tiers.length} tier{group.tiers.length !== 1 ? 's' : ''}</span>
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={e => { e.stopPropagation(); removePricingGroup(gi) }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>

            {!group.collapsed && (
              <div className="p-4 space-y-4">
                {/* Option selectors + city */}
                {!readOnly && (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {selectedOptions.map(opt => {
                      const fd = getFieldDef(opt.field_definition_id)
                      if (!fd || !OPTION_FIELD_TYPES.has(fd.field_type)) return null
                      const selectedValue = getSelectedValueForField(group, fd.id)
                      const availableValues = fd.field_option_values.filter(v => opt.value_ids.includes(v.id))

                      const selectedLabel = availableValues.find(v => v.id === selectedValue)?.value

                      return (
                        <div key={fd.id}>
                          <Label className="text-xs">{fd.label}</Label>
                          <Select value={selectedValue} onValueChange={v => updateGroupOptionValue(gi, fd.id, v)}>
                            <SelectTrigger className="mt-1 h-9 text-sm">
                              {selectedLabel
                                ? <span>{selectedLabel}</span>
                                : <SelectValue placeholder={`Select ${fd.label}`} />
                              }
                            </SelectTrigger>
                            <SelectContent>
                              {availableValues.sort((a, b) => a.sort_order - b.sort_order).map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                    <div>
                      <Label className="text-xs">City</Label>
                      <Select value={group.city_id ?? '__all__'} onValueChange={v => updateGroupCity(gi, v === '__all__' ? null : v)}>
                        <SelectTrigger className="mt-1 h-9 text-sm">
                          <span>{group.city_id ? (cities.find(c => c.id === group.city_id)?.name ?? 'Unknown') : 'All Cities'}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Cities</SelectItem>
                          {cities.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Read-only option/city display */}
                {readOnly && (
                  <p className="text-sm text-muted-foreground">{getGroupLabel(group)}</p>
                )}

                {/* Tier rows */}
                <div>
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground mb-1 px-1">
                    <span>Quantity</span>
                    <span>Price ({'₹'})</span>
                    <span>Completion (min)</span>
                    <span></span>
                  </div>
                  {group.tiers.map((tier, ti) => (
                    <div key={ti} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-1.5">
                      <Input
                        type="number"
                        min={1}
                        placeholder="25"
                        value={tier.quantity}
                        onChange={e => updateTier(gi, ti, 'quantity', e.target.value)}
                        className="h-9"
                        disabled={readOnly}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="120"
                        value={tier.price}
                        onChange={e => updateTier(gi, ti, 'price', e.target.value)}
                        className="h-9"
                        disabled={readOnly}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Optional"
                        value={tier.max_completion_minutes}
                        onChange={e => updateTier(gi, ti, 'max_completion_minutes', e.target.value)}
                        className="h-9"
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9" onClick={() => removeTier(gi, ti)} disabled={group.tiers.length <= 1}>
                          <XIcon className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {readOnly && <div />}
                    </div>
                  ))}
                  {!readOnly && (
                    <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addTier(gi)}>
                      <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Tier
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── FAQs ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FAQs</p>
            <InfoTooltip text="Question & answer pairs displayed on the product page." />
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setFaqs(prev => [...prev, { question: '', answer: '' }])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add FAQ
            </Button>
          )}
        </div>
        {faqs.length > 0 && (
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input placeholder="Question" value={faq.question} onChange={e => setFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, question: e.target.value } : f))} className="flex-1" disabled={disabled} />
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFaqs(prev => prev.filter((_, idx) => idx !== i))}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <textarea placeholder="Answer" value={faq.answer} onChange={e => setFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, answer: e.target.value } : f))} disabled={disabled} className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y bg-transparent" rows={2} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Finish & Care ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finish & Care</p>
            <InfoTooltip text="Bullet points with care instructions." />
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setFinishAndCare(prev => [...prev, ''])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Point
            </Button>
          )}
        </div>
        {finishAndCare.length > 0 && (
          <div className="space-y-2">
            {finishAndCare.map((point, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Care instruction point" value={point} onChange={e => setFinishAndCare(prev => prev.map((p, idx) => idx === i ? e.target.value : p))} className="flex-1" disabled={disabled} />
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFinishAndCare(prev => prev.filter((_, idx) => idx !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Guidelines ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guidelines</p>
            <InfoTooltip text="Guidelines with icon, title, and description." />
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setGuidelinesArr(prev => [...prev, { icon_url: '', title: '', description: '' }])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Guideline
            </Button>
          )}
        </div>
        {guidelinesArr.length > 0 && (
          <div className="space-y-3">
            {guidelinesArr.map((g, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    {g.icon_url ? (
                      <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.icon_url} alt="" className="h-14 w-14 rounded-lg object-cover border" />
                        {!readOnly && (
                          <button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, icon_url: '' } : gl))}>
                            <XIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : !readOnly ? (
                      <label className="flex items-center justify-center h-14 w-14 rounded-lg border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors">
                        {uploadingGuidelineIcon === i ? (
                          <span className="text-xs text-muted-foreground">...</span>
                        ) : (
                          <UploadIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploadingGuidelineIcon(i)
                          try {
                            const url = await uploadToCloudinary(file)
                            setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, icon_url: url } : gl))
                          } catch { toast.error('Icon upload failed') }
                          finally { setUploadingGuidelineIcon(null) }
                        }} />
                      </label>
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input placeholder="Title" value={g.title} onChange={e => setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, title: e.target.value } : gl))} disabled={disabled} />
                    <textarea placeholder="Description" value={g.description} onChange={e => setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, description: e.target.value } : gl))} disabled={disabled} className="w-full rounded-md border px-3 py-2 text-sm min-h-[50px] resize-y bg-transparent" rows={2} />
                  </div>
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => setGuidelinesArr(prev => prev.filter((_, idx) => idx !== i))}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Specifications ── */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specifications</p>
            <InfoTooltip text="Key-value pairs displayed on the product page." />
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setSpecifications(prev => [...prev, { key: '', value: '' }])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Spec
            </Button>
          )}
        </div>
        {specifications.length > 0 && (
          <div className="space-y-2">
            {specifications.map((spec, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Key (e.g. Material)" value={spec.key} onChange={e => setSpecifications(prev => prev.map((s, idx) => idx === i ? { ...s, key: e.target.value } : s))} className="w-[180px] shrink-0" disabled={disabled} />
                <Input placeholder="Value" value={spec.value} onChange={e => setSpecifications(prev => prev.map((s, idx) => idx === i ? { ...s, value: e.target.value } : s))} className="flex-1" disabled={disabled} />
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSpecifications(prev => prev.filter((_, idx) => idx !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
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
