'use client'

import { useEffect, useMemo, useState } from 'react'
import { PlusIcon, XIcon, ChevronDownIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { InfoTooltip } from '@/components/ui/info-tooltip'

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

export interface VariantOptionEntry { id: string; price_modifier: number }
export interface QuantitySlabEntry {
  min_qty: number
  max_qty: number | null
  price_modifier: number
  max_completion_minutes: number | null
}

export interface CustomFieldOptionInput {
  product_field_id: string
  field_option_value_id: string
  price_modifier: number
  is_default?: boolean
}

export interface CustomFieldDef {
  product_field_id: string
  field_definition_id: string
  label: string
  options: { id: string; name: string }[]
}

export interface CityPricingEntry {
  city_id: string
  price_modifier: number
}

export interface PriceRequestPayload {
  product_id: string
  base_price: number
  paper_sizes: { paper_size_id: string; price_modifier: number }[]
  paper_qualities: { paper_quality_id: string; price_modifier: number }[]
  paper_types: { paper_type_id: string; price_modifier: number }[]
  quantity_slabs: QuantitySlabEntry[]
  custom_field_options: CustomFieldOptionInput[]
  city_pricing: CityPricingEntry[]
  notes: string | null
  faqs: { question: string; answer: string }[]
  finish_and_care: string[]
  guidelines: { icon_url: string; title: string; description: string }[]
  specifications: { key: string; value: string }[]
}

export interface PriceRequestInitial {
  base_price?: number
  paper_sizes?: { paper_size_id: string; price_modifier: number; name?: string }[]
  paper_qualities?: { paper_quality_id: string; price_modifier: number; name?: string }[]
  paper_types?: { paper_type_id: string; price_modifier: number; name?: string }[]
  quantity_slabs?: QuantitySlabEntry[]
  custom_field_options?: CustomFieldOptionInput[]
  city_pricing?: CityPricingEntry[]
  notes?: string | null
  faqs?: { question: string; answer: string }[]
  finish_and_care?: string[]
  guidelines?: { icon_url: string; title: string; description: string }[]
  specifications?: { key: string; value: string }[]
}

export interface FieldOptionValueCatalog { id: string; value: string; sort_order: number }
export interface FieldDefCatalog {
  id: string
  key: string
  label: string
  field_type: 'select' | 'multi_select' | 'boolean' | 'number' | 'text' | 'textarea' | 'file_upload' | 'radio'
  field_option_values: FieldOptionValueCatalog[]
}

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

const OPTION_FIELD_TYPES = new Set(['select', 'multi_select', 'boolean', 'radio'])

interface PaperSize { id: string; name: string }
interface PaperQuality { id: string; name: string }
interface PaperTypeOption { id: string; name: string }
interface CityOption { id: string; name: string; state: string }

type OptionEntry = { id: string; name: string; price_modifier: string }
type QtySlab = { min_qty: string; max_qty: string; price_modifier: string; max_completion_minutes: string }
type CityEntry = { city_id: string; city_name: string; price_modifier: string }

function toQtySlabs(slabs?: QuantitySlabEntry[]): QtySlab[] {
  return (slabs ?? []).map(s => ({
    min_qty: String(s.min_qty),
    max_qty: s.max_qty != null ? String(s.max_qty) : '',
    price_modifier: String(s.price_modifier),
    max_completion_minutes: s.max_completion_minutes != null ? String(s.max_completion_minutes) : '',
  }))
}

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

function VariantOptionSection({
  title, description, readOnly, entries, setEntries, available, pending, setPending, placeholder, onCreateOption, createPlaceholder,
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
  onCreateOption?: (name: string) => Promise<void>
  createPlaceholder?: string
}) {
  const [newOptVal, setNewOptVal] = useState('')
  const [creatingOpt, setCreatingOpt] = useState(false)

  async function handleCreate() {
    if (!newOptVal.trim() || !onCreateOption) return
    setCreatingOpt(true)
    try {
      await onCreateOption(newOptVal.trim())
      setNewOptVal('')
    } finally { setCreatingOpt(false) }
  }

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
      {!readOnly && onCreateOption && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={createPlaceholder ?? 'New option name'}
            value={newOptVal}
            onChange={e => setNewOptVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
            className="flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={creatingOpt || !newOptVal.trim()}>
            <PlusIcon className="h-3.5 w-3.5 mr-1" /> {creatingOpt ? '...' : 'Create'}
          </Button>
        </div>
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
        <p className="text-sm text-muted-foreground">
          {readOnly ? 'None' : `No ${title.toLowerCase()} pricing configured yet — add some above.`}
        </p>
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
  customFields = [],
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
  paperSizes?: PaperSize[]
  paperQualities?: { id: string; gsm: number; label: string | null }[]
  paperTypes?: PaperTypeOption[]
  customFields?: CustomFieldDef[]
  fieldCatalog?: FieldDefCatalog[]
  cities?: CityOption[]
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

  // Custom field option modifiers: { [field_option_value_id]: price_modifier string }
  const [customFieldModifiers, setCustomFieldModifiers] = useState<Record<string, string>>(() => {
    const mods: Record<string, string> = {}
    for (const o of initial?.custom_field_options ?? []) mods[o.field_option_value_id] = String(o.price_modifier)
    return mods
  })
  // Default option per custom field: { [product_field_id]: field_option_value_id }
  const [customFieldDefaults, setCustomFieldDefaults] = useState<Record<string, string>>(() => {
    const defs: Record<string, string> = {}
    for (const o of initial?.custom_field_options ?? []) {
      if (o.is_default) defs[o.product_field_id] = o.field_option_value_id
    }
    return defs
  })

  // City pricing
  const [cityPricingSel, setCityPricingSel] = useState<CityEntry[]>(() =>
    (initial?.city_pricing ?? []).map(c => {
      const city = cities.find(x => x.id === c.city_id)
      return { city_id: c.city_id, city_name: city?.name ?? c.city_id, price_modifier: String(c.price_modifier) }
    })
  )
  const [pendingCity, setPendingCity] = useState('')

  // --- content sections ---
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(initial?.faqs ?? [])
  const [finishAndCare, setFinishAndCare] = useState<string[]>(initial?.finish_and_care ?? [])
  const [guidelinesArr, setGuidelinesArr] = useState<{ icon_url: string; title: string; description: string }[]>(initial?.guidelines ?? [])
  const [specifications, setSpecifications] = useState<{ key: string; value: string }[]>(initial?.specifications ?? [])
  const [uploadingGuidelineIcon, setUploadingGuidelineIcon] = useState<number | null>(null)

  // Local custom fields state so new options appear immediately
  const [localCustomFields, setLocalCustomFields] = useState<CustomFieldDef[]>(customFields)
  useEffect(() => { setLocalCustomFields(customFields) }, [customFields])

  // Field definition catalog — supplied by parent (loaded once on page) instead of fetching here
  const [fieldCatalog, setFieldCatalog] = useState<FieldDefCatalog[]>(fieldCatalogProp)
  useEffect(() => { setFieldCatalog(fieldCatalogProp) }, [fieldCatalogProp])
  const [pendingFieldId, setPendingFieldId] = useState('')
  const [creatingField, setCreatingField] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('select')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [savingField, setSavingField] = useState(false)

  const availableFieldDefs = fieldCatalog.filter(fd =>
    !localCustomFields.some(cf => cf.field_definition_id === fd.id)
  )

  function addFieldFromCatalog(def: FieldDefCatalog) {
    if (localCustomFields.some(cf => cf.field_definition_id === def.id)) return
    const tempId = `new_${def.id}`
    const options = (def.field_option_values ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(ov => ({ id: ov.id, name: ov.value }))
    setLocalCustomFields(prev => [...prev, {
      product_field_id: tempId,
      field_definition_id: def.id,
      label: def.label,
      options,
    }])
    if (OPTION_FIELD_TYPES.has(def.field_type) && options.length > 0) {
      const mods: Record<string, string> = {}
      const defs: Record<string, string> = {}
      for (const opt of options) mods[opt.id] = '0'
      defs[tempId] = options[0].id
      setCustomFieldModifiers(prev => ({ ...prev, ...mods }))
      setCustomFieldDefaults(prev => ({ ...prev, ...defs }))
    }
  }

  function removeCustomField(fieldDefId: string) {
    setLocalCustomFields(prev => prev.filter(cf => cf.field_definition_id !== fieldDefId))
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
      // Append to local catalog so it's immediately available
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

  // re-sync when initial changes (e.g. loaded after mount)
  useEffect(() => {
    if (!initial) return
    if (initial.base_price != null) setBasePrice(String(initial.base_price))
    setPaperSizesSel((initial.paper_sizes ?? []).map(s => ({ id: s.paper_size_id, name: s.name ?? '', price_modifier: String(s.price_modifier) })))
    setPaperQualitiesSel((initial.paper_qualities ?? []).map(q => ({ id: q.paper_quality_id, name: q.name ?? '', price_modifier: String(q.price_modifier) })))
    setPaperTypesSel((initial.paper_types ?? []).map(t => ({ id: t.paper_type_id, name: t.name ?? '', price_modifier: String(t.price_modifier) })))
    setQtySlabs(toQtySlabs(initial.quantity_slabs))
    setNotes(initial.notes ?? '')
    const mods: Record<string, string> = {}
    const defs: Record<string, string> = {}
    for (const o of initial.custom_field_options ?? []) {
      mods[o.field_option_value_id] = String(o.price_modifier)
      if (o.is_default) defs[o.product_field_id] = o.field_option_value_id
    }
    setCustomFieldModifiers(mods)
    setCustomFieldDefaults(defs)
    setCityPricingSel((initial.city_pricing ?? []).map(c => {
      const city = cities.find(x => x.id === c.city_id)
      return { city_id: c.city_id, city_name: city?.name ?? c.city_id, price_modifier: String(c.price_modifier) }
    }))
    setFaqs(initial.faqs ?? [])
    setFinishAndCare(initial.finish_and_care ?? [])
    setGuidelinesArr(initial.guidelines ?? [])
    setSpecifications(initial.specifications ?? [])
  }, [initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const [localPaperSizes, setLocalPaperSizes] = useState(paperSizes)
  const [localPaperTypes, setLocalPaperTypes] = useState(paperTypeOptions)
  useEffect(() => { setLocalPaperSizes(paperSizes) }, [paperSizes])
  useEffect(() => { setLocalPaperTypes(paperTypeOptions) }, [paperTypeOptions])

  const availableSizes = localPaperSizes.filter(s => !paperSizesSel.some(x => x.id === s.id))
  const availableQualities = paperQualities.filter(q => !paperQualitiesSel.some(x => x.id === q.id))
  const availableTypes = localPaperTypes.filter(t => !paperTypesSel.some(x => x.id === t.id))
  const availableCities = cities.filter(c => !cityPricingSel.some(x => x.city_id === c.id))

  async function createPaperSize(name: string) {
    const res = await api.post<{ data: PaperSize }>('/printer/paper/sizes', { name, sort_order: localPaperSizes.length })
    const created = res.data
    setLocalPaperSizes(prev => [...prev, created])
    setPaperSizesSel(prev => [...prev, { id: created.id, name: created.name, price_modifier: '' }])
    toast.success(`Paper size "${name}" created`)
  }

  async function createPaperType(name: string) {
    const res = await api.post<{ data: PaperTypeOption }>('/printer/paper/types', { name, sort_order: localPaperTypes.length })
    const created = res.data
    setLocalPaperTypes(prev => [...prev, created])
    setPaperTypesSel(prev => [...prev, { id: created.id, name: created.name, price_modifier: '' }])
    toast.success(`Paper type "${name}" created`)
  }

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
      custom_field_options: localCustomFields.flatMap(cf =>
        cf.options.map(opt => ({
          product_field_id: cf.product_field_id,
          field_option_value_id: opt.id,
          price_modifier: Number(customFieldModifiers[opt.id] || 0),
          is_default: (customFieldDefaults[cf.product_field_id] ?? cf.options[0]?.id) === opt.id,
        }))
      ),
      city_pricing: cityPricingSel.map(c => ({
        city_id: c.city_id,
        price_modifier: Number(c.price_modifier) || 0,
      })),
      notes: notes.trim() || null,
      faqs: faqs.filter(f => f.question.trim()),
      finish_and_care: finishAndCare.filter(p => p.trim()),
      guidelines: guidelinesArr.filter(g => g.title.trim()),
      specifications: specifications.filter(s => s.key.trim()),
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
        onCreateOption={readOnly ? undefined : createPaperSize}
        createPlaceholder="e.g. A4, A5, 3.5x2 in"
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
        onCreateOption={readOnly ? undefined : createPaperType}
        createPlaceholder="e.g. Glossy, Matte, Kraft"
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
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'None' : 'No quantity slabs configured yet — add one above.'}
          </p>
        )}
      </section>

      {/* Custom fields management */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom fields</p>
          <InfoTooltip text="Add configurable fields customers will see when ordering this product (e.g. Finish, Binding style). You can pick from existing field types or create a new one." />
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
                  placeholder="Add field from catalog…"
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

        {localCustomFields.length > 0 ? (
          <div className="space-y-4">
            {localCustomFields.map(cf => (
              <div key={cf.product_field_id} className="rounded-md border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{cf.label}</p>
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCustomField(cf.field_definition_id)}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {cf.options.length > 0 && (
                  <div className="rounded-md border divide-y bg-background">
                    {cf.options.map(opt => {
                      const isDefault = (customFieldDefaults[cf.product_field_id] ?? cf.options[0]?.id) === opt.id
                      return (
                        <div key={opt.id} className="flex items-center gap-3 px-3 py-2">
                          {!readOnly && (
                            <input
                              type="radio"
                              name={`default_${cf.product_field_id}`}
                              checked={isDefault}
                              onChange={() => setCustomFieldDefaults(p => ({ ...p, [cf.product_field_id]: opt.id }))}
                              title="Set as default"
                              className="shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium w-28 shrink-0 truncate">{opt.name}</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+/- ₹</span>
                            <Input
                              type="number"
                              className="pl-12"
                              value={customFieldModifiers[opt.id] ?? ''}
                              disabled={disabled}
                              onChange={e => setCustomFieldModifiers(p => ({ ...p, [opt.id]: e.target.value }))}
                            />
                          </div>
                          {isDefault && (
                            <span className="text-xs text-muted-foreground shrink-0">(default)</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {!readOnly && cf.field_definition_id && (
                  <PriceFieldOptionCreator
                    fieldDefId={cf.field_definition_id}
                    onCreated={(opt) => {
                      setLocalCustomFields(prev => prev.map(f =>
                        f.product_field_id === cf.product_field_id
                          ? { ...f, options: [...f.options, { id: opt.id, name: opt.value }] }
                          : f
                      ))
                      setCustomFieldModifiers(p => ({ ...p, [opt.id]: '0' }))
                      if (cf.options.length === 0) {
                        setCustomFieldDefaults(p => ({ ...p, [cf.product_field_id]: opt.id }))
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'No custom fields configured.' : 'No custom fields added yet — pick from the catalog or create a new type above.'}
          </p>
        )}
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

      {/* City pricing */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">City pricing</p>
          <InfoTooltip text="Propose city-specific price modifiers for this product. Add a city and set how much to add (+) or subtract (-) from the base price per unit for orders from that city." />
        </div>
        {!readOnly && cities.length > 0 && (
          <Combobox
            options={availableCities.map(c => ({ value: c.id, label: `${c.name}, ${c.state}` }))}
            value={pendingCity}
            onValueChange={v => {
              const city = cities.find(c => c.id === v)
              if (!city || cityPricingSel.some(x => x.city_id === city.id)) return
              setCityPricingSel(p => [...p, { city_id: city.id, city_name: city.name, price_modifier: '' }])
              setPendingCity('')
            }}
            placeholder="Add city pricing…"
            searchPlaceholder="Search cities…"
          />
        )}
        {cityPricingSel.length > 0 ? (
          <div className="rounded-md border divide-y">
            {cityPricingSel.map((entry, i) => (
              <div key={entry.city_id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm font-medium w-36 shrink-0 truncate">{entry.city_name}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+/- ₹</span>
                  <Input
                    type="number"
                    className="pl-12"
                    value={entry.price_modifier}
                    disabled={disabled}
                    onChange={ev => setCityPricingSel(p => p.map((x, j) => j === i ? { ...x, price_modifier: ev.target.value } : x))}
                  />
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCityPricingSel(p => p.filter((_, j) => j !== i))}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'None' : 'No city-specific pricing configured — add a city above.'}
          </p>
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
