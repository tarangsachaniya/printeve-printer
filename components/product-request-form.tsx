'use client'

import { useEffect, useRef, useState } from 'react'
import { PlusIcon, VideoIcon, XIcon, UploadIcon } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { InfoTooltip } from '@/components/ui/info-tooltip'

export interface VariantOptionEntry { id: string; price_modifier: number }
export interface QuantitySlabEntry {
  min_qty: number
  max_qty: number | null
  unit_price: number
  max_completion_minutes: number | null
}

export interface ProductRequestPayload {
  name: string
  base_price: number
  description: string | null
  paper_sizes: { paper_size_id: string; price_modifier: number }[]
  paper_types: { paper_type_id: string; price_modifier: number }[]
  quantity_slabs: QuantitySlabEntry[]
  images: string[]
  video_url: string | null
}

export interface ProductRequestInitial {
  name?: string
  base_price?: number
  description?: string | null
  paper_sizes?: { paper_size_id: string; price_modifier: number; name?: string }[]
  paper_types?: { paper_type_id: string; price_modifier: number; name?: string }[]
  quantity_slabs?: QuantitySlabEntry[]
  images?: string[]
  video_url?: string | null
}

interface PaperSize { id: string; name: string }
interface PaperTypeOption { id: string; name: string }

// Display row carries the master-option id, its name (for label), and the modifier amount as a string for editing
type OptionEntry = { id: string; name: string; price_modifier: string }
type QtySlab = { min_qty: string; max_qty: string; unit_price: string; max_completion_minutes: string }

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

export function buildProductRequestPayload(
  name: string,
  basePrice: string,
  descHtml: string,
  paperSizesSel: OptionEntry[],
  paperTypesSel: OptionEntry[],
  qtySlabs: QtySlab[],
  images: string[],
  videoUrl: string,
): ProductRequestPayload {
  return {
    name: name.trim(),
    base_price: Number(basePrice),
    description: descHtml || null,
    paper_sizes: paperSizesSel.map(s => ({ paper_size_id: s.id, price_modifier: Number(s.price_modifier) || 0 })),
    paper_types: paperTypesSel.map(t => ({ paper_type_id: t.id, price_modifier: Number(t.price_modifier) || 0 })),
    quantity_slabs: qtySlabs.map(s => ({
      min_qty: Number(s.min_qty),
      max_qty: s.max_qty ? Number(s.max_qty) : null,
      unit_price: Number(s.unit_price),
      max_completion_minutes: s.max_completion_minutes ? Number(s.max_completion_minutes) : null,
    })),
    images,
    video_url: videoUrl || null,
  }
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
      {entries.length > 0 && (
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
      )}
    </section>
  )
}

export function ProductRequestForm({
  initial,
  readOnly = false,
  onSubmit,
  submitLabel = 'Submit request',
  saving = false,
  formId = 'product-request-form',
  hideSubmit = false,
  paperSizes = [],
  paperTypes: paperTypeOptions = [],
}: {
  initial?: ProductRequestInitial
  readOnly?: boolean
  onSubmit?: (data: ProductRequestPayload) => void | Promise<void>
  submitLabel?: string
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
  paperSizes?: PaperSize[]
  paperTypes?: PaperTypeOption[]
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [basePrice, setBasePrice] = useState(initial?.base_price != null ? String(initial.base_price) : '')
  const [paperSizesSel, setPaperSizesSel] = useState<OptionEntry[]>(
    (initial?.paper_sizes ?? []).map(s => ({ id: s.paper_size_id, name: s.name ?? '', price_modifier: String(s.price_modifier) })),
  )
  const [paperTypesSel, setPaperTypesSel] = useState<OptionEntry[]>(
    (initial?.paper_types ?? []).map(t => ({ id: t.paper_type_id, name: t.name ?? '', price_modifier: String(t.price_modifier) })),
  )
  const [qtySlabs, setQtySlabs] = useState<QtySlab[]>(
    (initial?.quantity_slabs ?? []).map(s => ({
      min_qty: String(s.min_qty),
      max_qty: s.max_qty != null ? String(s.max_qty) : '',
      unit_price: String(s.unit_price),
      max_completion_minutes: s.max_completion_minutes != null ? String(s.max_completion_minutes) : '',
    })),
  )
  const [pendingSize, setPendingSize] = useState('')
  const [pendingType, setPendingType] = useState('')
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

  const availableSizes = paperSizes.filter(s => !paperSizesSel.some(x => x.id === s.id))
  const availableTypes = paperTypeOptions.filter(t => !paperTypesSel.some(x => x.id === t.id))

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
    const payload = buildProductRequestPayload(
      name, basePrice, getDescriptionHtml(), paperSizesSel,
      paperTypesSel, qtySlabs, images, videoUrl,
    )
    onSubmit(payload)
  }

  const disabled = readOnly || saving

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic info</p>
          <InfoTooltip text="The product name shown to customers and the base price per unit before any size, quality, or quantity adjustments are applied." />
        </div>
        <div className="space-y-1.5">
          <Label>Product name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} disabled={disabled} required />
        </div>
        <div className="space-y-1.5">
          <Label>Base price (₹) *</Label>
          <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} disabled={disabled} required />
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
              <ToolbarButton onClick={() => descEditor?.chain().focus().undo().run()} disabled={!descEditor?.can().undo()}>↩</ToolbarButton>
              <ToolbarButton onClick={() => descEditor?.chain().focus().redo().run()} disabled={!descEditor?.can().redo()}>↪</ToolbarButton>
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

      <VariantOptionSection
        title="Paper sizes"
        description="Select the paper sizes this product can be printed in. For each size, enter how much to add (+) or subtract (-) from the base price per unit. Leave blank or enter 0 if the size has no extra charge."
        readOnly={readOnly}
        entries={paperSizesSel}
        setEntries={setPaperSizesSel}
        available={availableSizes}
        pending={pendingSize}
        setPending={setPendingSize}
        placeholder="Select size…"
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
        placeholder="Select type…"
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity slabs</p>
            <InfoTooltip text="Set price adjustments based on order quantity. For each range, enter how much to add (+) or subtract (-) per unit from the base price. Also set the maximum time (in minutes) to fulfill orders in that range. Leave Max Qty blank for open-ended slabs (e.g. 100+)." />
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => setQtySlabs(p => [...p, { min_qty: '', max_qty: '', unit_price: '', max_completion_minutes: '' }])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add slab
            </Button>
          )}
        </div>
        {qtySlabs.map((slab, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-center">
            <Input type="number" placeholder="Min qty" value={slab.min_qty} disabled={readOnly}
              onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, min_qty: e.target.value } : x))} />
            <Input type="number" placeholder="Max (∞ blank)" value={slab.max_qty} disabled={readOnly}
              onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, max_qty: e.target.value } : x))} />
            <Input type="number" placeholder="Base unit ₹" value={slab.unit_price} disabled={readOnly}
              onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
            <div className="flex gap-1">
              <Input type="number" placeholder="Completion (min)" value={slab.max_completion_minutes} disabled={readOnly}
                onChange={e => setQtySlabs(p => p.map((x, j) => j === i ? { ...x, max_completion_minutes: e.target.value } : x))} />
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQtySlabs(p => p.filter((_, j) => j !== i))}>
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      {onSubmit && !readOnly && !hideSubmit && (
        <Button type="submit" disabled={saving || uploadingImages || uploadingVideo} className="w-full">
          {saving ? 'Saving…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
