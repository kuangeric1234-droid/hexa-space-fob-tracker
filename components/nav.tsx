'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  PlusCircle,
  RotateCcw,
  AlertTriangle,
  Key,
  Users,
  ClipboardList,
  FileCheck,
  Settings,
  LogOut,
  Menu,
  X,
  CalendarDays,
  CalendarPlus,
} from 'lucide-react'
import { useState } from 'react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Fobs',
    items: [
      { href: '/issue', label: 'Issue fob', icon: PlusCircle },
      { href: '/return', label: 'Return fob', icon: RotateCcw },
      { href: '/lost', label: 'Lost fob', icon: AlertTriangle },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/fobs', label: 'Inventory', icon: Key },
      { href: '/members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'Function Space',
    items: [
      { href: '/function-space', label: 'Bookings', icon: CalendarDays },
      { href: '/function-space/new', label: 'New booking', icon: CalendarPlus },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/audit', label: 'Audit log', icon: ClipboardList },
      { href: '/audit-form/responses', label: 'Audit responses', icon: FileCheck },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-violet-50 text-violet-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-violet-600' : 'text-gray-400')} />
      {label}
    </Link>
  )
}

function SidebarContent({ pathname, onNavigate, onSignOut }: {
  pathname: string
  onNavigate?: () => void
  onSignOut: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-100">
        <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
          <Key className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm">Hexa fob tracker</span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <LogOut className="h-4 w-4 text-gray-400" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100 md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Key className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900">Hexa fob tracker</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1 text-gray-500">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute top-14 left-0 right-0 bg-white border-b shadow-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:h-screen md:sticky md:top-0 bg-white border-r border-gray-100">
        <SidebarContent pathname={pathname} onSignOut={handleSignOut} />
      </aside>
    </>
  )
}
