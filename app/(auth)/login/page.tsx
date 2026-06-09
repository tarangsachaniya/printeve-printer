'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Printer, PackageCheck, Wallet, Bell } from 'lucide-react'
import { login } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function PrinterIllustration() {
  const ink = 'var(--primary)'
  return (
    <svg viewBox="0 0 360 280" fill="none" className="w-full max-w-md drop-shadow-xl" aria-hidden="true">
      {/* outgoing sheet */}
      <rect x="120" y="34" width="120" height="92" rx="6" fill="white" />
      <rect x="136" y="54" width="88" height="7" rx="3.5" fill={ink} opacity="0.4" />
      <rect x="136" y="70" width="64" height="6" rx="3" fill={ink} opacity="0.22" />
      <rect x="136" y="86" width="76" height="6" rx="3" fill={ink} opacity="0.22" />
      <rect x="136" y="102" width="50" height="6" rx="3" fill={ink} opacity="0.22" />

      {/* printer body */}
      <rect x="62" y="128" width="236" height="90" rx="16" fill={ink} />
      <rect x="90" y="152" width="64" height="13" rx="6.5" fill="white" fillOpacity="0.9" />
      <circle cx="268" cy="158" r="6.5" fill="white" fillOpacity="0.9" />
      <circle cx="246" cy="158" r="6.5" fill="white" fillOpacity="0.45" />
      <rect x="90" y="178" width="160" height="6" rx="3" fill="white" fillOpacity="0.18" />

      {/* output tray + sheet */}
      <rect x="96" y="206" width="168" height="14" rx="7" fill={ink} opacity="0.65" />
      <rect x="112" y="198" width="136" height="60" rx="6" fill="white" />
      <rect x="128" y="216" width="100" height="7" rx="3.5" fill={ink} opacity="0.4" />
      <rect x="128" y="232" width="76" height="7" rx="3.5" fill={ink} opacity="0.22" />
      <rect x="128" y="248" width="88" height="7" rx="3.5" fill={ink} opacity="0.22" />

      {/* badge */}
      <circle cx="296" cy="118" r="17" fill={ink} />
      <path d="M289 118l4.5 4.5L307 113" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* base shadow */}
      <ellipse cx="180" cy="270" rx="124" ry="9" fill="black" opacity="0.12" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Branding panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] flex-col justify-between bg-primary text-primary-foreground p-10 xl:p-14 2xl:p-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Printer className="h-5 w-5" />
          </div>
          <span className="text-lg 2xl:text-xl font-semibold tracking-tight">PrintEve Printer</span>
        </div>

        <div className="flex justify-center text-primary-foreground/90 my-6">
          <PrinterIllustration />
        </div>

        <div className="space-y-6">
          <h1 className="font-semibold leading-tight text-[clamp(1.5rem,2.8vw,3.25rem)]">
            Run your print business, all in one place
          </h1>
          <p className="text-primary-foreground/75 text-[clamp(0.875rem,1.05vw,1.2rem)] max-w-md">
            Manage your product catalog, track requests, and stay on top of
            every job from your personalized printer dashboard.
          </p>
          <ul className="space-y-3 text-[clamp(0.8rem,1vw,1.1rem)] text-primary-foreground/85">
            <li className="flex items-center gap-3">
              <PackageCheck className="h-4 w-4 xl:h-5 xl:w-5 shrink-0" />
              Pick the products you want to offer
            </li>
            <li className="flex items-center gap-3">
              <Wallet className="h-4 w-4 xl:h-5 xl:w-5 shrink-0" />
              Submit and track pricing requests
            </li>
            <li className="flex items-center gap-3">
              <Bell className="h-4 w-4 xl:h-5 xl:w-5 shrink-0" />
              Get notified the moment something changes
            </li>
          </ul>
        </div>

        <p className="text-primary-foreground/60 text-xs 2xl:text-sm">
          © {new Date().getFullYear()} PrintEve. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-sm sm:max-w-md xl:max-w-lg">
          <div className="mb-6 sm:mb-8 xl:mb-10 text-center lg:text-left">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Printer className="h-5.5 w-5.5" />
            </div>
            <h1 className="font-semibold tracking-tight text-[clamp(1.35rem,3.4vw,2.5rem)]">
              Welcome back
            </h1>
            <p className="mt-1.5 text-muted-foreground text-[clamp(0.8rem,1.7vw,1.15rem)]">
              Sign in to your printer account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 xl:space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[clamp(0.8rem,1.4vw,1.05rem)]">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@printshop.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 sm:h-11 xl:h-13 text-[clamp(0.85rem,1.7vw,1.1rem)]"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-[clamp(0.8rem,1.4vw,1.05rem)]">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-[clamp(0.7rem,1.3vw,0.95rem)] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 sm:h-11 xl:h-13 text-[clamp(0.85rem,1.7vw,1.1rem)]"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-[clamp(0.78rem,1.4vw,1rem)] text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-10 sm:h-11 xl:h-13 text-[clamp(0.85rem,1.7vw,1.1rem)]"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 xl:mt-8 text-center lg:text-left text-[clamp(0.75rem,1.4vw,1rem)] text-muted-foreground">
            New here? Reach out to PrintEve to get your printer account set up.
          </p>
        </div>
      </div>
    </div>
  )
}
