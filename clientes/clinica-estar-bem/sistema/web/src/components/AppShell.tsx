'use client'

import { useState } from 'react'
import { SidebarNav } from '@/components/SidebarNav'
import { LogoutButton } from '@/components/LogoutButton'

type NavItem = { href: string; label: string }

type Props = {
  navItems: NavItem[]
  userName: string
  role: 'admin' | 'professional'
  printable?: boolean
  children: React.ReactNode
}

export function AppShell({ navItems, userName, role, printable, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`flex h-screen bg-gray-50 ${printable ? 'print:block print:h-auto print:bg-white' : ''}`}>

      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-gray-200 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:translate-x-0',
          printable ? 'print:hidden' : '',
        ].join(' ')}
      >
        <div className="px-5 py-4 border-b border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Núcleo Estar Bem"
            className="h-14 w-auto mix-blend-multiply"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            {role === 'admin' ? 'Administrador' : 'Profissional'}
          </p>
        </div>

        <SidebarNav items={navItems} onNavigate={() => setOpen(false)} />

        <div className="px-3 py-4 border-t border-gray-200 space-y-0.5">
          <p className="text-xs text-gray-500 truncate px-3 mb-2">{userName}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Barra superior mobile */}
        <header className={`md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 ${printable ? 'print:hidden' : ''}`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-2 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="Núcleo Estar Bem" className="h-8 w-auto mix-blend-multiply" />
        </header>

        <main className={`flex-1 overflow-auto p-4 md:p-8 ${printable ? 'print:p-8 print:overflow-visible' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
