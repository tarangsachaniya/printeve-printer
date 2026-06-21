'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

export interface PrinterLocation {
  address: string
  city: string
  pincode: string
  latitude?: number
  longitude?: number
}

export interface BankDetails {
  account_holder: string
  bank_name: string
  account_number: string
  ifsc_code: string
  upi_id?: string
}

export interface PrinterProfile {
  id: string
  business_name: string
  status: string
  rating: number
  created_at: string
  description?: string | null
  area?: string | null
  agreed_at?: string | null
  signature_data?: string | null
  printer_locations: PrinterLocation[]
  printer_bank_details: BankDetails | null
  user: { email: string; phone: string; full_name: string } | null
  legal_terms?: string | null
}

export interface PrinterAgreement {
  legal_terms: string
  already_signed: boolean
  agreed_at: string | null
  readiness: {
    location_set: boolean
    bank_set: boolean
    products_set: boolean
    signature_set: boolean
  }
  ready_to_sign: boolean
  profile_complete: boolean
}

export interface PrinterProduct {
  id: string
  name: string
  slug: string | null
  selected: boolean
}

interface BootstrapData {
  profile: PrinterProfile
  agreement: PrinterAgreement
  products: PrinterProduct[]
}

interface BootstrapContextValue {
  profile: PrinterProfile | null
  agreement: PrinterAgreement | null
  products: PrinterProduct[]
  loading: boolean
  refetch: () => Promise<void>
  setProfile: (updater: (profile: PrinterProfile | null) => PrinterProfile | null) => void
  setAgreement: (updater: (agreement: PrinterAgreement | null) => PrinterAgreement | null) => void
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null)

export function BootstrapProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PrinterProfile | null>(null)
  const [agreement, setAgreement] = useState<PrinterAgreement | null>(null)
  const [products, setProducts] = useState<PrinterProduct[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBootstrap = useCallback(async () => {
    const res = await api.get<{ data: BootstrapData }>('/printer/bootstrap')
    setProfile(res.data.profile)
    setAgreement(res.data.agreement)
    setProducts(res.data.products)
  }, [])

  const refetch = useCallback(async () => {
    await fetchBootstrap()
  }, [fetchBootstrap])

  useEffect(() => {
    fetchBootstrap()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fetchBootstrap])

  return (
    <BootstrapContext.Provider value={{ profile, agreement, products, loading, refetch, setProfile, setAgreement }}>
      {children}
    </BootstrapContext.Provider>
  )
}

export function useBootstrap() {
  const ctx = useContext(BootstrapContext)
  if (!ctx) throw new Error('useBootstrap must be used within a BootstrapProvider')
  return ctx
}
