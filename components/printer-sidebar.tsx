'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Briefcase, User, Package, LogOut, Radio, IndianRupee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout, getCurrentUser, type PrinterUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard',        label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/available-orders', label: 'Available Orders', icon: Radio },
  { href: '/jobs',             label: 'My Jobs',         icon: Briefcase },
  { href: '/pricing',          label: 'My Pricing',      icon: IndianRupee },
  { href: '/products',         label: 'Products',        icon: Package },
  { href: '/profile',          label: 'Profile',         icon: User },
]

export function PrinterSidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<PrinterUser | null>(null)

  useEffect(() => {
    setUser(getCurrentUser())
  }, [])

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r bg-sidebar h-screen sticky top-0">
      <div className="flex items-center h-16 px-6 border-b">
        <span className="font-bold text-lg tracking-tight">PrintEve</span>
        <span className="ml-2 text-xs text-muted-foreground">Printer</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t">
        <div className="px-3 py-2 text-xs text-muted-foreground mb-2">
          {user?.role?.toUpperCase()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
