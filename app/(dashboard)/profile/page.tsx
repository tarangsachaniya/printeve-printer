'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

interface PrinterLocation {
  address: string
  city: string
  pincode: string
  latitude?: number
  longitude?: number
}

interface BankDetails {
  account_holder: string
  bank_name: string
  account_number: string
  ifsc_code: string
  upi_id?: string
}

interface PrinterProfile {
  id: string
  business_name: string
  email: string
  phone: string
  status: string
  rating: number
  created_at: string
  description?: string | null
  area?: string | null
  printer_locations: PrinterLocation[]
  printer_bank_details: BankDetails | null
}

interface ProfileResponse {
  data: PrinterProfile
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active:    'default',
  pending:   'outline',
  suspended: 'destructive',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<PrinterProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // About & Service Area edit state
  const [aboutEdit, setAboutEdit] = useState(false)
  const [areaInput, setAreaInput] = useState('')
  const [aboutSaving, setAboutSaving] = useState(false)
  const [aboutSaved, setAboutSaved] = useState(false)

  const descEditor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: { attributes: { class: 'prose prose-sm max-w-none min-h-[160px] px-4 py-3 focus:outline-none' } },
  })

  useEffect(() => {
    api.get<ProfileResponse>('/printer/profile')
      .then((res) => {
        setProfile(res.data)
        setAreaInput(res.data.area ?? '')
        descEditor?.commands.setContent(res.data.description ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [descEditor])

  async function handleAboutSave() {
    setAboutSaving(true)
    try {
      await api.patch('/printer/profile/about', {
        description: descEditor?.getHTML() ?? '',
        area: areaInput,
      })
      setProfile(prev => prev ? { ...prev, description: descEditor?.getHTML(), area: areaInput } : prev)
      setAboutSaved(true)
      setAboutEdit(false)
      setTimeout(() => setAboutSaved(false), 2000)
    } catch { /* no-op */ }
    finally { setAboutSaving(false) }
  }

  const location = profile?.printer_locations?.[0] ?? null
  const bank = profile?.printer_bank_details ?? null

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <Link
          href="/setup"
          className="text-sm font-medium text-primary hover:underline"
        >
          Edit Setup →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : profile ? (
        <div className="space-y-4">

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{profile.business_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 text-sm">
              <div className="grid grid-cols-2 gap-y-2.5">
                <Row label="Email" value={profile.email} />
                <Row label="Phone" value={profile.phone} />
                <Row label="Status" value={
                  <Badge variant={STATUS_VARIANT[profile.status] ?? 'outline'}>{profile.status}</Badge>
                } />
                <Row label="Rating" value={profile.rating ?? '—'} />
                <Row label="Member since" value={new Date(profile.created_at).toLocaleDateString('en-IN')} />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shop Location</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {location ? (
                <div className="grid grid-cols-2 gap-y-2.5">
                  <Row label="Address" value={location.address} />
                  <Row label="City" value={location.city} />
                  <Row label="Pincode" value={location.pincode} />
                  {location.latitude && <Row label="Coordinates" value={`${location.latitude}, ${location.longitude}`} />}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground">No location added.</p>
                  <Link href="/setup" className="text-xs text-primary hover:underline">Add →</Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {bank ? (
                <div className="grid grid-cols-2 gap-y-2.5">
                  <Row label="Account Holder" value={bank.account_holder} />
                  <Row label="Bank" value={bank.bank_name} />
                  <Row label="Account No." value={`••••${bank.account_number.slice(-4)}`} />
                  <Row label="IFSC" value={bank.ifsc_code} />
                  {bank.upi_id && <Row label="UPI" value={bank.upi_id} />}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground">No bank details added.</p>
                  <Link href="/setup" className="text-xs text-primary hover:underline">Add →</Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About & Service Area */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">About & Service Area</CardTitle>
              {!aboutEdit ? (
                <Button size="sm" variant="outline" onClick={() => setAboutEdit(true)}>
                  {aboutSaved ? 'Saved!' : 'Edit'}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAboutEdit(false)} disabled={aboutSaving}>Cancel</Button>
                  <Button size="sm" onClick={handleAboutSave} disabled={aboutSaving}>
                    {aboutSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
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
                        <ToolbarButton onClick={() => descEditor?.chain().focus().toggleBulletList().run()} active={descEditor?.isActive('bulletList')}>• List</ToolbarButton>
                        <ToolbarButton onClick={() => descEditor?.chain().focus().toggleOrderedList().run()} active={descEditor?.isActive('orderedList')}>1. List</ToolbarButton>
                        <div className="w-px h-5 bg-border mx-1" />
                        <ToolbarButton onClick={() => descEditor?.chain().focus().undo().run()} disabled={!descEditor?.can().undo()}>↩</ToolbarButton>
                        <ToolbarButton onClick={() => descEditor?.chain().focus().redo().run()} disabled={!descEditor?.can().redo()}>↪</ToolbarButton>
                      </div>
                      <EditorContent editor={descEditor} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="area-input" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service Area</Label>
                    <Input
                      id="area-input"
                      value={areaInput}
                      onChange={e => setAreaInput(e.target.value)}
                      placeholder="e.g. Koramangala, Indiranagar, HSR Layout"
                    />
                  </div>
                </>
              ) : (
                <>
                  {profile.description ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: profile.description }}
                    />
                  ) : (
                    <p className="text-muted-foreground">No description added yet.</p>
                  )}
                  {profile.area && (
                    <div className="pt-1 border-t">
                      <span className="text-muted-foreground">Service Area: </span>
                      <span>{profile.area}</span>
                    </div>
                  )}
                  {!profile.area && !profile.description && null}
                </>
              )}
            </CardContent>
          </Card>

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
