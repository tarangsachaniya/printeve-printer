'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Product {
  id: string
  name: string
  base_price: number
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

  // Step 0 — Legal
  const [legalHtml, setLegalHtml] = useState('')
  const [legalLoading, setLegalLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [signed, setSigned] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  // Step 3 — Products
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Step 4 — Bank
  const [accountHolder, setAccountHolder] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [upiId, setUpiId] = useState('')

  useEffect(() => {
    // Fetch legal terms (public endpoint, no auth needed)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3032'}/printer/legal`)
      .then(r => r.json())
      .then((d: { value: string }) => setLegalHtml(d.value ?? ''))
      .catch(() => setLegalHtml(''))
      .finally(() => setLegalLoading(false))

    api.get<{ items: Product[] }>('/printer/products')
      .then(res => setProducts(res.items ?? []))
      .catch(() => {})
  }, [])

  function toggleProduct(id: string) {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function getSignatureDataUrl(): string {
    return canvasRef.current?.toDataURL('image/png') ?? ''
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
        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
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
      } else if (step === 2) {
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
        const signature_data = getSignatureDataUrl()
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
  }, [step, oldPassword, newPassword, confirmPassword, address, city, pincode, latitude, longitude, selectedProducts, accountHolder, bankName, accountNumber, ifscCode, upiId])

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
                <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
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
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode <span className="text-destructive">*</span></Label>
                  <Input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="400001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Latitude <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="18.9750" />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="number" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="72.8258" />
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
                      <span className="text-sm text-muted-foreground">₹{p.base_price?.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
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
                  <SignatureCanvasInline canvasRef={canvasRef} onSigned={setSigned} />
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
          {step < TOTAL_STEPS - 1 && (
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

// ─── Inline canvas component (needs access to outer canvasRef) ───────────────

function SignatureCanvasInline({
  canvasRef,
  onSigned,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onSigned: (v: boolean) => void
}) {
  const drawing = useRef(false)

  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    return { canvas, ctx }
  }

  function initCanvas() {
    const r = getCtx()
    if (!r) return
    r.ctx.fillStyle = '#ffffff'
    r.ctx.fillRect(0, 0, r.canvas.width, r.canvas.height)
  }

  useEffect(() => {
    initCanvas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function checkSigned() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let hasMark = false
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) { hasMark = true; break }
    }
    onSigned(hasMark)
  }

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function posTouch(e: React.TouchEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    const t = e.touches[0]
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }

  function start(x: number, y: number) {
    drawing.current = true
    const r = getCtx(); if (!r) return
    r.ctx.beginPath(); r.ctx.moveTo(x, y)
  }

  function move(x: number, y: number) {
    if (!drawing.current) return
    const r = getCtx(); if (!r) return
    r.ctx.lineTo(x, y); r.ctx.stroke()
    checkSigned()
  }

  function stop() { drawing.current = false }

  function clear() { initCanvas(); onSigned(false) }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Draw your signature below
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="w-full rounded-lg border border-input bg-white touch-none cursor-crosshair"
        style={{ height: 180 }}
        onMouseDown={e => { const { x, y } = pos(e); start(x, y) }}
        onMouseMove={e => { const { x, y } = pos(e); move(x, y) }}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={e => { e.preventDefault(); const { x, y } = posTouch(e); start(x, y) }}
        onTouchMove={e => { e.preventDefault(); const { x, y } = posTouch(e); move(x, y) }}
        onTouchEnd={stop}
      />
      <p className="text-xs text-muted-foreground">Use mouse or touch to draw your signature</p>
    </div>
  )
}
