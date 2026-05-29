'use client'

import { useEffect, useRef, useState } from 'react'
import { PlusIcon, VideoIcon, XIcon, UploadIcon } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export interface ProductRequestPayload {
  name: string
  base_price: number
  description: string | null
  paper_sizes: string[]
  paper_qualities: { gsm: number; price: number }[]
  paper_types: { type: string; price: number }[]
  quantity_tiers: { min_qty: number; max_qty: number | null; unit_price: number }[]
  images: string[]
  video_url: string | null
}

export interface ProductRequestInitial {
  name?: string
  base_price?: number
  description?: string | null
  paper_sizes?: string[]
  paper_qualities?: { gsm: number; price: number }[]
  paper_types?: { type: string; price: number }[]
  quantity_tiers?: { min_qty: number; max_qty: number | null; unit_price: number }[]
  images?: string[]
  video_url?: string | null
}

interface PaperSize { id: string; name: string }
interface PaperQualityOption { id: string; gsm: number; label: string | null }
interface PaperTypeOption { id: string; name: string }

type Quality = { gsm: string; price: string }
type PaperTypeEntry = { type: string; price: string }
type QtyTier = { min_qty: string; max_qty: string; unit_price: string }

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

async function uploadToCloudinary(file: File, type: 'image' | 'video'): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET)
    throw new Error('Cloudinary is not configured')

  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'printvana/products')
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
  paperSizesSel: string[],
  qualities: Quality[],
  paperTypes: PaperTypeEntry[],
  qtyTiers: QtyTier[],
  images: string[],
  videoUrl: string,
): ProductRequestPayload {
  return {
    name: name.trim(),
    base_price: Number(basePrice),
    description: descHtml || null,
    paper_sizes: paperSizesSel,
    paper_qualities: qualities.map(q => ({ gsm: Number(q.gsm), price: Number(q.price) })),
    paper_types: paperTypes.map(t => ({ type: t.type, price: Number(t.price) })),
    quantity_tiers: qtyTiers.map(t => ({
      min_qty: Number(t.min_qty),
      max_qty: t.max_qty ? Number(t.max_qty) : null,
      unit_price: Number(t.unit_price),
    })),
    images,
    video_url: videoUrl || null,
  }
}

export function ProductRequestForm({
  initial,
  readOnly = false,
  onSubmit,
  submitLabel = 'Submit request',
  saving = false,
  formId = 'product-request-form',
  hideSubmit = false,
}: {
  initial?: ProductRequestInitial
  readOnly?: boolean
  onSubmit?: (data: ProductRequestPayload) => void | Promise<void>
  submitLabel?: string
  saving?: boolean
  formId?: string
  hideSubmit?: boolean
}) {
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([])
  const [paperQualityOptions, setPaperQualityOptions] = useState<PaperQualityOption[]>([])
  const [paperTypeOptions, setPaperTypeOptions] = useState<PaperTypeOption[]>([])

  const [name, setName] = useState(initial?.name ?? '')
  const [basePrice, setBasePrice] = useState(initial?.base_price != null ? String(initial.base_price) : '')
  const [paperSizesSel, setPaperSizesSel] = useState<string[]>(initial?.paper_sizes ?? [])
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
  const [pendingGsm, setPendingGsm] = useState('')
  const [pendingType, setPendingType] = useState('')
  const [pendingSize, setPendingSize] = useState('')
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
    Promise.all([
      api.get<{ items: PaperSize[] }>('/printer/paper/sizes'),
      api.get<{ items: PaperQualityOption[] }>('/printer/paper/qualities'),
      api.get<{ items: PaperTypeOption[] }>('/printer/paper/types'),
    ]).then(([sizes, qualities, types]) => {
      setPaperSizes(sizes.items ?? [])
      setPaperQualityOptions(qualities.items ?? [])
      setPaperTypeOptions(types.items ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initial?.description != null && descEditor)
      descEditor.commands.setContent(initial.description)
  }, [initial?.description, descEditor])

  function qualityDisplay(gsm: string) {
    const opt = paperQualityOptions.find(q => String(q.gsm) === gsm)
    return opt?.label ? `${gsm} gsm — ${opt.label}` : `${gsm} gsm`
  }

  const availableQualities = paperQualityOptions.filter(
    q => !qualities.some(x => x.gsm === String(q.gsm)),
  )
  const availableTypes = paperTypeOptions.filter(
    t => !paperTypes.some(x => x.type === t.name),
  )

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
      qualities, paperTypes, qtyTiers, images, videoUrl,
    )
    onSubmit(payload)
  }

  const disabled = readOnly || saving

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic info</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product images</p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product video</p>
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

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper sizes</p>
        {paperSizesSel.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {paperSizesSel.map(s => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 text-primary px-2.5 py-0.5 text-sm">
                {s}
                {!readOnly && (
                  <button type="button" onClick={() => setPaperSizesSel(prev => prev.filter(x => x !== s))}>
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {!readOnly && paperSizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {paperSizes.filter(s => !paperSizesSel.includes(s.name)).map(s => (
              <button key={s.id} type="button" onClick={() => setPaperSizesSel(prev => [...prev, s.name])}
                className="rounded-full border px-2.5 py-0.5 text-sm hover:border-primary">+ {s.name}</button>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="flex gap-2">
            <Input placeholder="Custom size" value={pendingSize} onChange={e => setPendingSize(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = pendingSize.trim(); if (v && !paperSizesSel.includes(v)) { setPaperSizesSel(p => [...p, v]); setPendingSize('') } } }} />
            <Button type="button" variant="outline" size="icon" onClick={() => { const v = pendingSize.trim(); if (v && !paperSizesSel.includes(v)) { setPaperSizesSel(p => [...p, v]); setPendingSize('') } }} disabled={!pendingSize.trim()}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper quality (GSM)</p>
        {!readOnly && paperQualityOptions.length > 0 && (
          <div className="flex gap-2">
            <Select value={pendingGsm || null} onValueChange={v => setPendingGsm(v ?? '')}>
              <SelectTrigger className="flex-1 w-full min-w-0"><SelectValue placeholder="Select GSM…" /></SelectTrigger>
              <SelectContent>
                {availableQualities.map(q => (
                  <SelectItem key={q.id} value={String(q.gsm)}>{q.gsm} gsm{q.label ? ` — ${q.label}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" disabled={!pendingGsm} onClick={() => {
              if (!pendingGsm || qualities.some(q => q.gsm === pendingGsm)) return
              setQualities(p => [...p, { gsm: pendingGsm, price: '' }]); setPendingGsm('')
            }}><PlusIcon className="h-4 w-4" /></Button>
          </div>
        )}
        {qualities.length > 0 && (
          <div className="rounded-md border divide-y">
            {qualities.map((q, i) => (
              <div key={q.gsm} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm font-medium w-36 shrink-0">{qualityDisplay(q.gsm)}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input type="number" className="pl-7" value={q.price} disabled={readOnly}
                    onChange={e => setQualities(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                </div>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQualities(p => p.filter((_, j) => j !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paper type</p>
        {!readOnly && paperTypeOptions.length > 0 && (
          <div className="flex gap-2">
            <Select value={pendingType || null} onValueChange={v => setPendingType(v ?? '')}>
              <SelectTrigger className="flex-1 w-full min-w-0"><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {availableTypes.map(t => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" disabled={!pendingType} onClick={() => {
              if (!pendingType || paperTypes.some(t => t.type === pendingType)) return
              setPaperTypes(p => [...p, { type: pendingType, price: '' }]); setPendingType('')
            }}><PlusIcon className="h-4 w-4" /></Button>
          </div>
        )}
        {paperTypes.length > 0 && (
          <div className="rounded-md border divide-y">
            {paperTypes.map((t, i) => (
              <div key={t.type} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm font-medium w-24 shrink-0">{t.type}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input type="number" className="pl-7" value={t.price} disabled={readOnly}
                    onChange={e => setPaperTypes(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                </div>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPaperTypes(p => p.filter((_, j) => j !== i))}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity tiers</p>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => setQtyTiers(p => [...p, { min_qty: '', max_qty: '', unit_price: '' }])}>
              <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add tier
            </Button>
          )}
        </div>
        {qtyTiers.map((tier, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <Input type="number" placeholder="Min" value={tier.min_qty} disabled={readOnly}
              onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, min_qty: e.target.value } : x))} />
            <Input type="number" placeholder="Max (∞ blank)" value={tier.max_qty} disabled={readOnly}
              onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, max_qty: e.target.value } : x))} />
            <div className="flex gap-1">
              <Input type="number" placeholder="Unit ₹" value={tier.unit_price} disabled={readOnly}
                onChange={e => setQtyTiers(p => p.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQtyTiers(p => p.filter((_, j) => j !== i))}>
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
