'use client'

import { useEffect, useRef, useState } from 'react'
import { PlusIcon, VideoIcon, XIcon, UploadIcon, GripVerticalIcon, ChevronDownIcon, ChevronRight, Trash2, WandSparklesIcon } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface FieldOptionValueCatalog {
  id: string
  value: string
  sort_order: number
}

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

export interface ProductRequestPayload {
  name: string
  description: string | null
  images: string[]
  video_url: string | null
  options: { field_definition_id: string; sort_order: number; is_required: boolean; value_ids: string[] }[]
  pricing_matrix: { quantity: number; price: number; max_completion_minutes: number | null; option_value_ids: string[]; city_id: string | null }[]
  faqs: { question: string; answer: string }[]
  finish_and_care: string[]
  guidelines: { icon_url: string; title: string; description: string }[]
  specifications: { key: string; value: string }[]
}

export interface ProductRequestInitial {
  name?: string
  description?: string | null
  images?: string[]
  video_url?: string | null
  options?: { field_definition_id: string; sort_order?: number; is_required?: boolean; value_ids?: string[] }[]
  pricing_matrix?: { quantity: number; price: number; max_completion_minutes: number | null; option_value_ids: string[]; city_id: string | null }[]
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

function ToolbarButton({
  onClick, active, disabled, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''

function toWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
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

async function uploadToCloudinary(file: File, type: 'image' | 'video'): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET)
    throw new Error('Cloudinary is not configured')

  const fd = new FormData()
  if (type === 'image') {
    const webp = await toWebP(file)
    fd.append('file', webp, file.name.replace(/\.[^.]+$/, '.webp'))
  } else {
    fd.append('file', file)
  }
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'printEve/products')
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`, {
    method: 'POST',
    body: fd,
  })
  const data = await res.json() as { secure_url?: string; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Cloudinary upload failed')
  return data.secure_url!
}

function InlineOptionCreator({ fieldDefId, onCreated }: {
  fieldDefId: string
  onCreated: (opt: FieldOptionValueCatalog) => void
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
    <div className="flex items-center gap-2 mt-1">
      <Input
        placeholder="New option value"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
        className="flex-1 h-7 text-xs"
      />
      <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={creating || !value.trim()} className="h-7 text-xs">
        <PlusIcon className="h-3 w-3 mr-1" /> {creating ? '...' : 'Create'}
      </Button>
    </div>
  )
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap(a => arr.map(v => [...a, v])), [[]])
}

export function ProductRequestForm({
  initial,
  readOnly = false,
  onSubmit,
  submitLabel = 'Submit request',
  saving = false,
  formId = 'product-request-form',
  hideSubmit = false,
  fieldCatalog: fieldCatalogProp = [],
  cities = [],
}: {
  initial?: ProductRequestInitial
  readOnly?: boolean
  onSubmit?: (data: ProductRequestPayload) => void | Promise<void>
  submitLabel?: string
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
  fieldCatalog?: FieldDefCatalog[]
  cities?: { id: string; name: string; state: string }[]
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [images, setImages] = useState<string[]>(initial?.images ?? [])
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? '')
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [imgDragOver, setImgDragOver] = useState(false)
  const [vidDragOver, setVidDragOver] = useState(false)
  const [showDescHtml, setShowDescHtml] = useState(false)
  const [descHtmlValue, setDescHtmlValue] = useState('')
  const imgInputRef = useRef<HTMLInputElement>(null)
  const vidInputRef = useRef<HTMLInputElement>(null)

  // --- content sections ---
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(initial?.faqs ?? [])
  const [finishAndCare, setFinishAndCare] = useState<string[]>(initial?.finish_and_care ?? [])
  const [guidelinesArr, setGuidelinesArr] = useState<{ icon_url: string; title: string; description: string }[]>(initial?.guidelines ?? [])
  const [specifications, setSpecifications] = useState<{ key: string; value: string }[]>(initial?.specifications ?? [])
  const [uploadingGuidelineIcon, setUploadingGuidelineIcon] = useState<number | null>(null)

  // --- dynamic options ---
  const [fieldCatalog, setFieldCatalog] = useState<FieldDefCatalog[]>(fieldCatalogProp)
  const [selectedOptions, setSelectedOptions] = useState<OptionEntry[]>([])
  const [pendingField, setPendingField] = useState('')
  const [creatingField, setCreatingField] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('select')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [savingField, setSavingField] = useState(false)
  const dragFieldIndexRef = useRef<number | null>(null)
  const [fieldDragOver, setFieldDragOver] = useState<number | null>(null)

  // --- pricing groups ---
  const [pricingGroups, setPricingGroups] = useState<PricingGroup[]>([])

  // When the catalog or initial changes, sync
  useEffect(() => {
    setFieldCatalog(fieldCatalogProp)
  }, [fieldCatalogProp])

  useEffect(() => {
    if (fieldCatalogProp.length === 0) return
    const initOpts = initial?.options ?? []
    if (initOpts.length > 0) {
      setSelectedOptions(initOpts.map((o, i) => ({
        field_definition_id: o.field_definition_id,
        sort_order: o.sort_order ?? i,
        is_required: o.is_required ?? false,
        value_ids: o.value_ids ?? [],
      })))
    }
    const initMatrix = initial?.pricing_matrix ?? []
    if (initMatrix.length > 0) {
      // Group flat rows by (option_value_ids + city_id) into PricingGroup[]
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
    }
  }, [fieldCatalogProp, initial])

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

  function onFieldDragStart(index: number) {
    dragFieldIndexRef.current = index
  }

  function onFieldDrop(targetIndex: number) {
    const from = dragFieldIndexRef.current
    if (from === null || from === targetIndex) return
    dragFieldIndexRef.current = null
    setFieldDragOver(null)
    setSelectedOptions(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(targetIndex, 0, moved)
      return arr.map((o, i) => ({ ...o, sort_order: i }))
    })
  }

  function toggleValueId(optIndex: number, fovId: string) {
    setSelectedOptions(prev => prev.map((opt, i) => {
      if (i !== optIndex) return opt
      const has = opt.value_ids.includes(fovId)
      return { ...opt, value_ids: has ? opt.value_ids.filter(v => v !== fovId) : [...opt.value_ids, fovId] }
    }))
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

  const descEditor = useEditor({
    extensions: [StarterKit],
    content: initial?.description ?? '',
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'prose prose-sm max-w-none min-h-[180px] px-4 py-3 focus:outline-none' } },
  })

  function toggleDescHtml() {
    if (!descEditor) return
    if (!showDescHtml) {
      setDescHtmlValue(descEditor.getHTML())
    } else {
      descEditor.commands.setContent(descHtmlValue)
    }
    setShowDescHtml(v => !v)
  }

  useEffect(() => {
    if (initial?.description != null && descEditor)
      descEditor.commands.setContent(initial.description)
  }, [initial?.description, descEditor])

  const availableFieldsForPicker = fieldCatalog.filter(d => !selectedOptions.some(o => o.field_definition_id === d.id))

  async function uploadImageFiles(files: File[]) {
    if (!files.length || readOnly) return
    setUploadingImages(true)
    try {
      const urls = await Promise.all(files.map(f => uploadToCloudinary(f, 'image')))
      setImages(prev => [...prev, ...urls])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image upload failed')
    } finally { setUploadingImages(false) }
  }

  async function uploadVideoFile(file: File) {
    setUploadingVideo(true)
    try {
      setVideoUrl(await uploadToCloudinary(file, 'video'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Video upload failed')
    } finally { setUploadingVideo(false) }
  }

  async function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    await uploadImageFiles(files)
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadVideoFile(file)
    if (vidInputRef.current) vidInputRef.current.value = ''
  }

  function onImgDrop(e: React.DragEvent) {
    e.preventDefault()
    setImgDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    uploadImageFiles(files)
  }

  function onVidDrop(e: React.DragEvent) {
    e.preventDefault()
    setVidDragOver(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('video/'))
    if (file) uploadVideoFile(file)
  }

  function getDescriptionHtml() {
    if (showDescHtml) return descHtmlValue
    return descEditor?.getHTML() ?? ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!onSubmit || readOnly) return
    const descHtml = getDescriptionHtml()
    const payload: ProductRequestPayload = {
      name: name.trim(),
      description: descHtml || null,
      images,
      video_url: videoUrl || null,
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
      faqs: faqs.filter(f => f.question.trim()),
      finish_and_care: finishAndCare.filter(p => p.trim()),
      guidelines: guidelinesArr.filter(g => g.title.trim()),
      specifications: specifications.filter(s => s.key.trim()),
    }
    onSubmit(payload)
  }

  const disabled = readOnly || saving

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic info</p>
          <InfoTooltip text="The product name shown to customers." />
        </div>
        <div className="space-y-1.5">
          <Label>Product name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} disabled={disabled} required />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
          <InfoTooltip text="Describe what this product includes — material, finish, use case, etc. This is shown to customers on the product page." />
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          {!readOnly && (
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40 flex-wrap">
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleBold().run()} active={descEditor?.isActive('bold')}><strong>B</strong></ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleItalic().run()} active={descEditor?.isActive('italic')}><em>I</em></ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleStrike().run()} active={descEditor?.isActive('strike')}><s>S</s></ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleHeading({ level: 2 }).run()} active={descEditor?.isActive('heading', { level: 2 })}>H2</ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleHeading({ level: 3 }).run()} active={descEditor?.isActive('heading', { level: 3 })}>H3</ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleBulletList().run()} active={descEditor?.isActive('bulletList')}>Bullet List</ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().toggleOrderedList().run()} active={descEditor?.isActive('orderedList')}>Ordered List</ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton onClick={() => descEditor?.chain().focus().undo().run()} disabled={!descEditor?.can().undo()}>&#x21A9;</ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().redo().run()} disabled={!descEditor?.can().redo()}>&#x21AA;</ToolbarButton>
              <div className="w-px h-5 bg-border mx-1" />
              <ToolbarButton onClick={toggleDescHtml} active={showDescHtml} disabled={!descEditor}>{'</>'}</ToolbarButton>
            </div>
          )}
          {readOnly ? (
            <div
              className="prose prose-sm max-w-none min-h-[120px] px-4 py-3"
              dangerouslySetInnerHTML={{ __html: initial?.description ?? '<p></p>' }}
            />
          ) : showDescHtml ? (
            <textarea
              value={descHtmlValue}
              onChange={e => setDescHtmlValue(e.target.value)}
              className="w-full min-h-[180px] px-4 py-3 font-mono text-xs resize-y focus:outline-none bg-transparent"
            />
          ) : (
            <EditorContent editor={descEditor} />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product images</p>
          <InfoTooltip text="Upload photos of this product. The first image is used as the thumbnail in listings. Supports PNG, JPG, and WEBP." />
        </div>
        {!readOnly && (
          <>
            <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageFiles} />
            <div
              onDragOver={e => { e.preventDefault(); setImgDragOver(true) }}
              onDragLeave={() => setImgDragOver(false)}
              onDrop={onImgDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
                imgDragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/30'
              }`}
              onClick={() => imgInputRef.current?.click()}
            >
              <UploadIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {uploadingImages ? 'Uploading…' : 'Drop images here or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP</p>
              </div>
            </div>
          </>
        )}
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative group rounded-md overflow-hidden border aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {readOnly && images.length === 0 && (
          <p className="text-sm text-muted-foreground">No images</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product video</p>
          <InfoTooltip text="Optional. Upload a short video to show the product quality or printing process. Displayed on the product page." />
        </div>
        {!readOnly && (
          <>
            <input ref={vidInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />
            <div
              onDragOver={e => { e.preventDefault(); setVidDragOver(true) }}
              onDragLeave={() => setVidDragOver(false)}
              onDrop={onVidDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
                vidDragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/30'
              }`}
              onClick={() => !videoUrl && vidInputRef.current?.click()}
            >
              <VideoIcon className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {uploadingVideo ? 'Uploading…' : videoUrl ? 'Video uploaded' : 'Drop video here or click to browse'}
              </p>
              {!videoUrl && <p className="text-xs text-muted-foreground">MP4, MOV, WEBM</p>}
            </div>
          </>
        )}
        {videoUrl && (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
            <VideoIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{videoUrl.split('/').pop()}</span>
            {!readOnly && (
              <button type="button" onClick={() => setVideoUrl('')}>
                <XIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        )}
        {readOnly && !videoUrl && (
          <p className="text-sm text-muted-foreground">No video</p>
        )}
      </section>

      {/* Dynamic options */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product options</p>
          <InfoTooltip text="Add configurable options customers will see when ordering (e.g. Paper Size, Finish, Binding style). Pick from the catalog or create a new field type. For each option, select which values are available for this product." />
        </div>

        {!readOnly && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  options={availableFieldsForPicker.map(d => ({ value: d.id, label: `${d.label} (${d.field_type})` }))}
                  value={pendingField}
                  onValueChange={v => {
                    const def = fieldCatalog.find(d => d.id === v)
                    if (!def) return
                    addFieldFromCatalog(def)
                    setPendingField('')
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

        {selectedOptions.length > 0 && (
          <div className="rounded-md border divide-y">
            {selectedOptions.map((opt, i) => {
              const def = fieldCatalog.find(d => d.id === opt.field_definition_id)
              const label = def?.label ?? opt.field_definition_id
              const hasOptionValues = def && OPTION_FIELD_TYPES.has(def.field_type)
              return (
                <div
                  key={opt.field_definition_id}
                  draggable={!readOnly}
                  onDragStart={() => onFieldDragStart(i)}
                  onDragOver={e => { e.preventDefault(); setFieldDragOver(i) }}
                  onDragLeave={() => setFieldDragOver(null)}
                  onDrop={() => onFieldDrop(i)}
                  className={`p-3 space-y-2 transition-colors ${fieldDragOver === i ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {!readOnly && (
                      <GripVerticalIcon className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                    )}
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

                  {/* Value selection for option-type fields */}
                  {hasOptionValues && def.field_option_values.length > 0 && (
                    <div className="ml-6 space-y-1">
                      <p className="text-xs text-muted-foreground mb-1">Select which values are available:</p>
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
                        <InlineOptionCreator
                          fieldDefId={opt.field_definition_id}
                          onCreated={(newOpt) => {
                            setFieldCatalog(prev => prev.map(fd =>
                              fd.id === opt.field_definition_id
                                ? { ...fd, field_option_values: [...fd.field_option_values, newOpt] }
                                : fd
                            ))
                            // Auto-select the new option
                            setSelectedOptions(prev => prev.map((o, j) =>
                              j === i ? { ...o, value_ids: [...o.value_ids, newOpt.id] } : o
                            ))
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Read-only display for non-option fields */}
                  {readOnly && !hasOptionValues && (
                    <p className="ml-6 text-xs text-muted-foreground">Customer input — no selectable values</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {readOnly && selectedOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">No product options</p>
        )}
      </section>

      {/* Pricing matrix — grouped UI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing matrix</p>
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
                          <Select value={selectedValue} onValueChange={v => { if (v) updateGroupOptionValue(gi, fd.id, v) }}>
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
                    <span>Price (&#x20B9;)</span>
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
                  <Input placeholder="Question" value={faq.question} onChange={e => setFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, question: e.target.value } : f))} className="flex-1" disabled={readOnly} />
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFaqs(prev => prev.filter((_, idx) => idx !== i))}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <textarea placeholder="Answer" value={faq.answer} onChange={e => setFaqs(prev => prev.map((f, idx) => idx === i ? { ...f, answer: e.target.value } : f))} disabled={readOnly} className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y bg-transparent" rows={2} />
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
                <Input placeholder="Care instruction point" value={point} onChange={e => setFinishAndCare(prev => prev.map((p, idx) => idx === i ? e.target.value : p))} className="flex-1" disabled={readOnly} />
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
                            const url = await uploadToCloudinary(file, 'image')
                            setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, icon_url: url } : gl))
                          } catch { toast.error('Icon upload failed') }
                          finally { setUploadingGuidelineIcon(null) }
                        }} />
                      </label>
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input placeholder="Title" value={g.title} onChange={e => setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, title: e.target.value } : gl))} disabled={readOnly} />
                    <textarea placeholder="Description" value={g.description} onChange={e => setGuidelinesArr(prev => prev.map((gl, idx) => idx === i ? { ...gl, description: e.target.value } : gl))} disabled={readOnly} className="w-full rounded-md border px-3 py-2 text-sm min-h-[50px] resize-y bg-transparent" rows={2} />
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
                <Input placeholder="Key (e.g. Material)" value={spec.key} onChange={e => setSpecifications(prev => prev.map((s, idx) => idx === i ? { ...s, key: e.target.value } : s))} className="w-[180px] shrink-0" disabled={readOnly} />
                <Input placeholder="Value" value={spec.value} onChange={e => setSpecifications(prev => prev.map((s, idx) => idx === i ? { ...s, value: e.target.value } : s))} className="flex-1" disabled={readOnly} />
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

      {onSubmit && !readOnly && !hideSubmit && (
        <Button type="submit" disabled={saving || uploadingImages || uploadingVideo} className="w-full">
          {saving ? 'Saving…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
