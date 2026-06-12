'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { validatePassword } from '@/lib/password'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { SignatureCanvas } from '@/components/signature-canvas'
import { useBootstrap } from '@/context/bootstrap-context'

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? ''
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ''

async function uploadSignatureToCloudinary(canvas: HTMLCanvasElement, name: string): Promise<string> {
  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signature'
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/png')
  )
  const fd = new FormData()
  fd.append('file', blob, `${safeName}.png`)
  fd.append('upload_preset', UPLOAD_PRESET)
  fd.append('folder', 'signatures')
  fd.append('public_id', safeName)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: fd,
  })
  const data = await res.json() as { secure_url?: string; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Signature upload failed')
  return data.secure_url!
}

// ─── TipTap toolbar ───────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default', pending: 'outline', suspended: 'destructive',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </>
  )
}

function SectionActions({
  editing, saving, onEdit, onCancel, onSave,
}: {
  editing: boolean
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!editing) {
    return <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, agreement, loading, setProfile } = useBootstrap()

  // Basic info
  const [basicEdit, setBasicEdit] = useState(false)
  const [basicForm, setBasicForm] = useState({ business_name: '', phone: '' })
  const [basicSaving, setBasicSaving] = useState(false)

  // Location
  const [locEdit, setLocEdit] = useState(false)
  const [locForm, setLocForm] = useState({ address: '', city: '', pincode: '', latitude: '', longitude: '' })
  const [locSaving, setLocSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  // Bank
  const [bankEdit, setBankEdit] = useState(false)
  const [bankForm, setBankForm] = useState({ account_holder: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '' })
  const [bankSaving, setBankSaving] = useState(false)

  // About
  const [aboutEdit, setAboutEdit] = useState(false)
  const [areaInput, setAreaInput] = useState('')
  const [aboutSaving, setAboutSaving] = useState(false)

  // Password
  const [pwEdit, setPwEdit] = useState(false)
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // Agreement / Signature
  const [sigEdit, setSigEdit] = useState(false)
  const [sigAgreed, setSigAgreed] = useState(false)
  const [sigSigned, setSigSigned] = useState(false)
  const [sigSaving, setSigSaving] = useState(false)
  const legalHtml = agreement?.legal_terms ?? ''
  const legalLoading = loading
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)

  const descEditor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose prose-sm max-w-none min-h-[140px] px-4 py-3 focus:outline-none' } },
  })

  useEffect(() => {
    if (!profile) return
    const d = profile
    setBasicForm({ business_name: d.business_name ?? '', phone: d.user?.phone ?? '' })
    setAreaInput(d.area ?? '')
    const loc = d.printer_locations?.[0]
    if (loc) setLocForm({
      address: loc.address ?? '',
      city: loc.city ?? '',
      pincode: loc.pincode ?? '',
      latitude: loc.latitude?.toString() ?? '',
      longitude: loc.longitude?.toString() ?? '',
    })
    const bank = d.printer_bank_details
    if (bank) setBankForm({
      account_holder: bank.account_holder ?? '',
      bank_name: bank.bank_name ?? '',
      account_number: bank.account_number ?? '',
      ifsc_code: bank.ifsc_code ?? '',
      upi_id: bank.upi_id ?? '',
    })
    descEditor?.commands.setContent(d.description ?? '')
  }, [profile, descEditor])

  async function saveBasicInfo() {
    setBasicSaving(true)
    try {
      await api.patch('/printer/profile/info', basicForm)
      setProfile(p => p ? { ...p, business_name: basicForm.business_name, user: p.user ? { ...p.user, phone: basicForm.phone } : p.user } : p)
      setBasicEdit(false)
      toast.success('Basic info updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally { setBasicSaving(false) }
  }

  async function saveLocation() {
    if (!locForm.address || !locForm.city || !locForm.pincode) {
      toast.error('Address, city and pincode are required')
      return
    }
    setLocSaving(true)
    try {
      await api.patch('/printer/profile/location', {
        address: locForm.address, city: locForm.city, pincode: locForm.pincode,
        latitude: locForm.latitude ? parseFloat(locForm.latitude) : undefined,
        longitude: locForm.longitude ? parseFloat(locForm.longitude) : undefined,
      })
      setProfile(p => p ? { ...p, printer_locations: [{ address: locForm.address, city: locForm.city, pincode: locForm.pincode, latitude: locForm.latitude ? parseFloat(locForm.latitude) : undefined, longitude: locForm.longitude ? parseFloat(locForm.longitude) : undefined }] } : p)
      setLocEdit(false)
      toast.success('Location updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update location')
    } finally { setLocSaving(false) }
  }

  async function saveBank() {
    setBankSaving(true)
    try {
      await api.patch('/printer/profile/bank', {
        account_holder: bankForm.account_holder,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        ifsc_code: bankForm.ifsc_code.toUpperCase(),
        upi_id: bankForm.upi_id || undefined,
      })
      setProfile(p => p ? { ...p, printer_bank_details: { account_holder: bankForm.account_holder, bank_name: bankForm.bank_name, account_number: bankForm.account_number, ifsc_code: bankForm.ifsc_code.toUpperCase(), upi_id: bankForm.upi_id || undefined } } : p)
      setBankEdit(false)
      toast.success('Bank details updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update bank details')
    } finally { setBankSaving(false) }
  }

  async function saveAbout() {
    setAboutSaving(true)
    try {
      await api.patch('/printer/profile/about', { description: descEditor?.getHTML() ?? '', area: areaInput })
      setProfile(p => p ? { ...p, description: descEditor?.getHTML(), area: areaInput } : p)
      setAboutEdit(false)
      toast.success('About updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update about')
    } finally { setAboutSaving(false) }
  }

  async function saveAgreement() {
    if (!sigCanvasRef.current) return
    setSigSaving(true)
    try {
      const signature_url = await uploadSignatureToCloudinary(sigCanvasRef.current, profile?.business_name ?? '')
      await api.patch('/printer/profile/agreement', { signature_url })
      setProfile(p => p ? { ...p, signature_data: signature_url, agreed_at: new Date().toISOString() } : p)
      setSigEdit(false)
      setSigAgreed(false)
      setSigSigned(false)
      toast.success('Agreement signed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign agreement')
    } finally { setSigSaving(false) }
  }

  async function changePassword() {
    setPwError('')
    const err = validatePassword(pwForm.new_password)
    if (err) { setPwError(err); return }
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    try {
      await api.patch('/printer/profile/password', { old_password: pwForm.old_password, new_password: pwForm.new_password })
      setPwForm({ old_password: '', new_password: '', confirm: '' })
      setPwEdit(false)
      toast.success('Password changed')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
    } finally { setPwSaving(false) }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setLocForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); setLocating(false) },
      () => { toast.error('Could not get location. Enter coordinates manually.'); setLocating(false) }
    )
  }

  const location = profile?.printer_locations?.[0] ?? null
  const bank = profile?.printer_bank_details ?? null

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : profile ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6">

            {/* Basic Info */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Basic Info</CardTitle>
                <SectionActions
                  editing={basicEdit} saving={basicSaving}
                  onEdit={() => setBasicEdit(true)}
                  onCancel={() => { setBasicEdit(false); setBasicForm({ business_name: profile.business_name ?? '', phone: profile.user?.phone ?? '' }) }}
                  onSave={saveBasicInfo}
                />
              </CardHeader>
              <CardContent className="text-sm">
                {basicEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="biz-name">Business Name</Label>
                      <Input id="biz-name" value={basicForm.business_name} onChange={e => setBasicForm(f => ({ ...f, business_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={basicForm.phone} onChange={e => setBasicForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-2.5">
                    <Row label="Business" value={profile.business_name} />
                    <Row label="Email" value={profile.user?.email ?? '—'} />
                    <Row label="Phone" value={profile.user?.phone ?? '—'} />
                    <Row label="Status" value={<Badge variant={STATUS_VARIANT[profile.status] ?? 'outline'}>{profile.status}</Badge>} />
                    <Row label="Rating" value={profile.rating ?? '—'} />
                    <Row label="Member since" value={new Date(profile.created_at).toLocaleDateString('en-IN')} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* About & Service Area */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">About & Service Area</CardTitle>
                <SectionActions
                  editing={aboutEdit} saving={aboutSaving}
                  onEdit={() => setAboutEdit(true)}
                  onCancel={() => { setAboutEdit(false); setAreaInput(profile.area ?? ''); descEditor?.commands.setContent(profile.description ?? '') }}
                  onSave={saveAbout}
                />
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                {aboutEdit ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40 flex-wrap">
                          <ToolbarButton onClick={() => descEditor?.chain().focus().toggleBold().run()} active={descEditor?.isActive('bold')}><strong>B</strong></ToolbarButton>
                          <ToolbarButton onClick={() => descEditor?.chain().focus().toggleItalic().run()} active={descEditor?.isActive('italic')}><em>I</em></ToolbarButton>
                          <ToolbarButton onClick={() => descEditor?.chain().focus().toggleStrike().run()} active={descEditor?.isActive('strike')}><s>S</s></ToolbarButton>
                          <div className="w-px h-5 bg-border mx-1" />
                          <ToolbarButton onClick={() => descEditor?.chain().focus().toggleBulletList().run()} active={descEditor?.isActive('bulletList')}>Bullet List</ToolbarButton>
                          <ToolbarButton onClick={() => descEditor?.chain().focus().toggleOrderedList().run()} active={descEditor?.isActive('orderedList')}>Ordered List</ToolbarButton>
                          <div className="w-px h-5 bg-border mx-1" />
                          <ToolbarButton onClick={() => descEditor?.chain().focus().undo().run()} disabled={!descEditor?.can().undo()}>↩</ToolbarButton>
                          <ToolbarButton onClick={() => descEditor?.chain().focus().redo().run()} disabled={!descEditor?.can().redo()}>↪</ToolbarButton>
                        </div>
                        <EditorContent editor={descEditor} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="area-input" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service Area</Label>
                      <Input id="area-input" value={areaInput} onChange={e => setAreaInput(e.target.value)} placeholder="e.g. Koramangala, Indiranagar, HSR Layout" />
                    </div>
                  </>
                ) : (
                  <>
                    {profile.description ? (
                      <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: profile.description }} />
                    ) : (
                      <p className="text-muted-foreground">No description added yet.</p>
                    )}
                    {profile.area && (
                      <div className="pt-1 border-t">
                        <span className="text-muted-foreground">Service Area: </span>
                        <span>{profile.area}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">

            {/* Shop Location */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Shop Location</CardTitle>
                <SectionActions
                  editing={locEdit} saving={locSaving}
                  onEdit={() => setLocEdit(true)}
                  onCancel={() => { setLocEdit(false); const l = profile.printer_locations?.[0]; if (l) setLocForm({ address: l.address ?? '', city: l.city ?? '', pincode: l.pincode ?? '', latitude: l.latitude?.toString() ?? '', longitude: l.longitude?.toString() ?? '' }) }}
                  onSave={saveLocation}
                />
              </CardHeader>
              <CardContent className="text-sm">
                {locEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Street Address <span className="text-destructive">*</span></Label>
                      <Input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} placeholder="Shop no., building, street" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>City <span className="text-destructive">*</span></Label>
                        <Input value={locForm.city} onChange={e => setLocForm(f => ({ ...f, city: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pincode <span className="text-destructive">*</span></Label>
                        <Input value={locForm.pincode} onChange={e => setLocForm(f => ({ ...f, pincode: e.target.value }))} placeholder="400001" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Coordinates <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <button type="button" onClick={useCurrentLocation} disabled={locating} className="text-xs text-primary hover:underline disabled:opacity-50">
                          {locating ? 'Locating…' : '⊕ Use current location'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" value={locForm.latitude} onChange={e => setLocForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Latitude" />
                        <Input type="number" value={locForm.longitude} onChange={e => setLocForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Longitude" />
                      </div>
                    </div>
                  </div>
                ) : location ? (
                  <div className="grid grid-cols-2 gap-y-2.5">
                    <Row label="Address" value={location.address} />
                    <Row label="City" value={location.city} />
                    <Row label="Pincode" value={location.pincode} />
                    {location.latitude && <Row label="Coordinates" value={`${location.latitude}, ${location.longitude}`} />}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No location added yet. Click Edit to add.</p>
                )}
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Bank Details</CardTitle>
                <SectionActions
                  editing={bankEdit} saving={bankSaving}
                  onEdit={() => setBankEdit(true)}
                  onCancel={() => { setBankEdit(false); const b = profile.printer_bank_details; if (b) setBankForm({ account_holder: b.account_holder ?? '', bank_name: b.bank_name ?? '', account_number: b.account_number ?? '', ifsc_code: b.ifsc_code ?? '', upi_id: b.upi_id ?? '' }) }}
                  onSave={saveBank}
                />
              </CardHeader>
              <CardContent className="text-sm">
                {bankEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Account Holder <span className="text-destructive">*</span></Label>
                      <Input value={bankForm.account_holder} onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))} placeholder="Full name as per bank" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bank Name <span className="text-destructive">*</span></Label>
                      <Input value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="State Bank of India" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Account Number <span className="text-destructive">*</span></Label>
                      <Input value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} placeholder="000123456789" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>IFSC Code <span className="text-destructive">*</span></Label>
                      <Input value={bankForm.ifsc_code} onChange={e => setBankForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))} placeholder="SBIN0001234" className="uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>UPI ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Input value={bankForm.upi_id} onChange={e => setBankForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="yourname@upi" />
                    </div>
                  </div>
                ) : bank ? (
                  <div className="grid grid-cols-2 gap-y-2.5">
                    <Row label="Account Holder" value={bank.account_holder} />
                    <Row label="Bank" value={bank.bank_name} />
                    <Row label="Account No." value={`••••${bank.account_number.slice(-4)}`} />
                    <Row label="IFSC" value={bank.ifsc_code} />
                    {bank.upi_id && <Row label="UPI" value={bank.upi_id} />}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No bank details added yet. Click Edit to add.</p>
                )}
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Agreement Signature</CardTitle>
                <Button size="sm" variant="outline" onClick={() => { setSigEdit(true); setSigAgreed(false); setSigSigned(false) }}>
                  {profile.signature_data ? 'Re-sign' : 'Sign Agreement'}
                </Button>
              </CardHeader>
              <CardContent className="text-sm space-y-4">
                {profile.signature_data ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-center">
                      <img src={profile.signature_data} alt="Signature" className="max-h-32 object-contain" />
                    </div>
                    {profile.agreed_at && (
                      <p className="text-muted-foreground text-xs">
                        Signed on {new Date(profile.agreed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Agreement not signed yet. Click Sign Agreement to proceed.</p>
                )}
              </CardContent>
            </Card>

            <Dialog open={sigEdit} onOpenChange={open => { if (!sigSaving) setSigEdit(open) }}>
              <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle>{profile.signature_data ? 'Re-sign agreement' : 'Sign agreement'}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
                  {legalLoading ? (
                    <div className="h-48 rounded-lg border bg-muted animate-pulse" />
                  ) : legalHtml ? (
                    <div
                      className="max-h-72 overflow-y-auto rounded-lg border bg-white px-5 py-4 text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: legalHtml }}
                    />
                  ) : (
                    <div className="rounded-lg border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
                      No legal terms have been configured yet. Please contact the administrator.
                    </div>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sigAgreed}
                      onChange={e => setSigAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                    />
                    <span className="text-sm font-medium leading-snug">
                      I have read and agree to the above terms and conditions
                    </span>
                  </label>

                  {sigAgreed && (
                    <div className="space-y-3 pt-1">
                      <div className="h-px bg-border" />
                      <SignatureCanvas canvasRef={sigCanvasRef} onSigned={setSigSigned} />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSigEdit(false)} disabled={sigSaving}>Cancel</Button>
                  <Button onClick={saveAgreement} disabled={sigSaving || !sigAgreed || !sigSigned}>
                    {sigSaving ? 'Saving…' : 'Submit Signature'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Change Password */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Change Password</CardTitle>
                {!pwEdit ? (
                  <Button size="sm" variant="outline" onClick={() => setPwEdit(true)}>Change</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setPwEdit(false); setPwForm({ old_password: '', new_password: '', confirm: '' }); setPwError('') }} disabled={pwSaving}>Cancel</Button>
                    <Button size="sm" onClick={changePassword} disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Save'}</Button>
                  </div>
                )}
              </CardHeader>
              {pwEdit && (
                <CardContent className="text-sm space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="old-pw">Current Password</Label>
                    <Input id="old-pw" type="password" value={pwForm.old_password} onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pw">New Password</Label>
                    <Input id="new-pw" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} placeholder="Min. 8 chars, uppercase, number, symbol" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw">Confirm New Password</Label>
                    <Input id="confirm-pw" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
                  </div>
                  {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                </CardContent>
              )}
            </Card>

          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground text-center">
            Could not load profile. Please try again.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
