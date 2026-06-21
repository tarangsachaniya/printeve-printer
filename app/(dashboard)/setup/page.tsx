'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useBootstrap } from '@/context/bootstrap-context'
import { validatePassword } from '@/lib/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { SignatureCanvas } from '@/components/signature-canvas'

const CLOUD_NAME   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   ?? ''
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

const TOTAL_STEPS = 5

const STEP_TITLES = [
  'Change Password',
  'Shop Location',
  'Product Configuration',
  'Bank Details',
  'Legal Agreement',
]

const STEP_DESCRIPTIONS = [
  'Set a secure password for your account.',
  'Add your shop address so customers can find you.',
  'Select the products your shop can print.',
  'Add your bank details to receive payouts.',
  'Read and sign the terms to activate your printer account.',
]

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 0 — Password
  const { agreement, products, loading: legalLoading } = useBootstrap()
  const legalHtml = agreement?.legal_terms ?? ''
  const [agreed, setAgreed] = useState(false)
  const [signed, setSigned] = useState(false)
  const signatureRef = useRef<HTMLCanvasElement>(null)

  async function getSignatureDataUrl(): Promise<string> {
    if (!signatureRef.current) throw new Error('Signature pad not ready')
    return uploadSignatureToCloudinary(signatureRef.current, 'signature')
  }

  // Step 1 — Password
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — Location
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [area, setArea] = useState('')
  const [locating, setLocating] = useState(false)
  const [allCities, setAllCities] = useState<{ id: string; name: string; state: string }[]>([])

  useEffect(() => {
    api.get<{ items: { id: string; name: string; state: string }[] }>('/printer/cities/all')
      .then(res => setAllCities(res.items ?? []))
      .catch(() => {})
  }, [])

  // Step 3 — Products
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Step 4 — Bank
  const [accountHolder, setAccountHolder] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [upiId, setUpiId] = useState('')

  useEffect(() => {
    setSelectedProducts(products.filter(p => p.selected).map(p => p.id))
  }, [products])

  function toggleProduct(id: string) {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Please allow location access or enter coordinates manually.')
        setLocating(false)
      }
    )
  }


  const handleNext = useCallback(async () => {
    setError('')
    setSaving(true)
    try {
      if (step === 0) {
        if (!oldPassword || !newPassword || !confirmPassword) {
          setError('All password fields are required.')
          return
        }
        if (newPassword !== confirmPassword) {
          setError('New passwords do not match.')
          return
        }
        const pwErr = validatePassword(newPassword)
        if (pwErr) { setError(pwErr); return }
        await api.patch('/printer/profile/password', { old_password: oldPassword, new_password: newPassword })
      } else if (step === 1) {
        if (!address || !city || !pincode) {
          setError('Address, city, and pincode are required.')
          return
        }
        await api.patch('/printer/profile/location', {
          address, city, pincode,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
        })
        if (area.trim()) {
          await api.patch('/printer/profile/about', { area: area.trim() })
        }
      } else if (step === 2) {
        if (selectedProducts.length > 0)
          await api.patch('/printer/profile/products', { product_ids: selectedProducts })
      } else if (step === 3) {
        if (!accountHolder || !bankName || !accountNumber || !ifscCode) {
          setError('All bank fields except UPI are required.')
          return
        }
        await api.patch('/printer/profile/bank', {
          account_holder: accountHolder,
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          upi_id: upiId || undefined,
        })
      } else if (step === 4) {
        // Agreement — save signature (last step, mandatory)
        const signature_data = await getSignatureDataUrl()
        await api.patch('/printer/profile/agreement', { signature_data })
        router.push('/dashboard')
        return
      }
      setStep(s => s + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, oldPassword, newPassword, confirmPassword, address, city, pincode, latitude, longitude, area, selectedProducts, accountHolder, bankName, accountNumber, ifscCode, upiId])

  function handleBack() {
    setError('')
    setStep(s => s - 1)
  }

  function handleSkip() {
    setError('')
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1)
    else router.push('/dashboard')
  }

  const canProceed = step === 4 ? agreed && signed : true

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-xl border shadow-sm overflow-hidden">

        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Step {step + 1} of {TOTAL_STEPS}
            </div>
            <h2 className="text-xl font-bold">{STEP_TITLES[step]}</h2>
            <p className="text-sm text-muted-foreground">{STEP_DESCRIPTIONS[step]}</p>
          </div>

          {/* ── Step 0: Password ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <PasswordInput value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New Password</label>
                <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 chars, uppercase, number, symbol" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm New Password</label>
                <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
            </div>
          )}

          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Street Address <span className="text-destructive">*</span></Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop no., building, street" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>City <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={allCities.map(c => ({ value: c.name, label: `${c.name}, ${c.state}` }))}
                    value={city}
                    onValueChange={v => setCity(v)}
                    placeholder="Select city…"
                    searchPlaceholder="Search city…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode <span className="text-destructive">*</span></Label>
                  <Input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="400001" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Locality <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="e.g. Koramangala, MG Road, Sector 15"
                />
                <p className="text-xs text-muted-foreground">Street, locality, or neighbourhood of your shop</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Coordinates <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {locating ? 'Locating…' : '⊕ Use current location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="Latitude (e.g. 18.9750)" />
                  <Input type="number" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="Longitude (e.g. 72.8258)" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Products ── */}
          {step === 2 && (
            <div className="space-y-3">
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products available yet. You can configure this later.</p>
              ) : (
                <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                  {products.map(p => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-sm font-medium flex-1">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedProducts.length > 0
                  ? `${selectedProducts.length} product${selectedProducts.length !== 1 ? 's' : ''} selected`
                  : 'None selected — you can add products later from the Products page.'}
              </p>
            </div>
          )}

          {/* ── Step 3: Bank ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Account Holder Name <span className="text-destructive">*</span></Label>
                <Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Full name as per bank" />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Name <span className="text-destructive">*</span></Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="State Bank of India" />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number <span className="text-destructive">*</span></Label>
                <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="000123456789" />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC Code <span className="text-destructive">*</span></Label>
                <Input value={ifscCode} onChange={e => setIfscCode(e.target.value)} placeholder="SBIN0001234" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>UPI ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" />
              </div>
            </div>
          )}

          {/* ── Step 4: Legal Terms + E-Sign ── */}
          {step === 4 && (
            <div className="space-y-5">
              {legalLoading ? (
                <div className="h-48 rounded-lg border bg-muted animate-pulse" />
              ) : legalHtml ? (
                <div
                  className="max-h-64 overflow-y-auto rounded-lg border bg-white px-5 py-4 text-sm prose prose-sm max-w-none"
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
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                />
                <span className="text-sm font-medium leading-snug">
                  I have read and agree to the above terms and conditions
                </span>
              </label>

              {agreed && (
                <div className="space-y-3 pt-1">
                  <div className="h-px bg-border" />
                  <SignatureCanvas
                    canvasRef={signatureRef}
                    onSigned={setSigned}
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={handleBack} disabled={saving} className="flex-1">
                Back
              </Button>
            )}
            <Button onClick={handleNext} disabled={saving || !canProceed} className="flex-1">
              {saving
                ? 'Saving…'
                : step === TOTAL_STEPS - 1
                  ? 'Sign & Finish'
                  : 'Next'}
            </Button>
          </div>

          {/* Skip — not available on last step (agreement is mandatory) */}
          {step === 0 && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip this step
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

