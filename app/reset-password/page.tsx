'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { validatePassword } from '@/lib/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="text-center space-y-2">
        <p className="text-sm text-destructive">Invalid or missing reset token.</p>
        <Link href="/login" className="text-sm hover:underline">Back to sign in</Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setError('')

    const err = validatePassword(password)
    if (err) { setPwError(err); return }
    if (password !== confirm) { setPwError('Passwords do not match.'); return }

    setLoading(true)
    try {
      await api.post('/printer/auth/reset-password', { token, new_password: password })
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')
        ? 'This reset link has expired or is invalid. Please request a new one.'
        : msg)
    } finally {
      setLoading(false)
    }
  }

  return done ? (
    <div className="text-center space-y-2">
      <p className="text-sm text-green-600">Password updated! Redirecting to sign in…</p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => { setPassword(e.target.value); setPwError('') }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setPwError('') }}
        />
      </div>
      {pwError && <p className="text-sm text-destructive">{pwError}</p>}
      {error && (
        <div className="space-y-1">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/forgot-password" className="text-xs hover:underline">
            Request a new reset link
          </Link>
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>Must be at least 8 characters with uppercase, number, and symbol.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
