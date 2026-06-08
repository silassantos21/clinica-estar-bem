import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/SidebarNav'
import { LogoutButton } from '@/components/LogoutButton'

const navItems = [
  { href: '/admin/dashboard',     label: 'Visão geral' },
  { href: '/admin/salas',         label: 'Salas' },
  { href: '/admin/psicologos',    label: 'Psicólogos' },
  { href: '/admin/reservas',      label: 'Reservas' },
  { href: '/admin/repasses',      label: 'Repasses' },
  { href: '/admin/relatorios',    label: 'Relatórios' },
  { href: '/admin/configuracoes', label: 'Configurações' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/psicologo/dashboard')

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Clínica Estar Bem" className="h-14 w-auto mix-blend-multiply" />
          <p className="text-xs text-gray-400 mt-1.5">Administrador</p>
        </div>

        <SidebarNav items={navItems} />

        <div className="px-3 py-4 border-t border-gray-200 space-y-1">
          <p className="text-xs text-gray-500 truncate px-3 mb-2">{profile?.name}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
