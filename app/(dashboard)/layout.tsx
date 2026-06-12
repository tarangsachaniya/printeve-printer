import { PrinterSidebar } from '@/components/printer-sidebar'
import { BootstrapProvider } from '@/context/bootstrap-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BootstrapProvider>
      <div className="flex h-screen overflow-hidden">
        <PrinterSidebar />
        <main className="flex-1 overflow-y-auto bg-muted/20">
          {children}
        </main>
      </div>
    </BootstrapProvider>
  )
}
