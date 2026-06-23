import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/AppShell'

const navItems = [
  { href: '/admin/dashboard',      label: 'Visão geral' },
  { href: '/admin/salas',          label: 'Salas' },
  { href: '/admin/bloqueios',      label: 'Bloqueios' },
  { href: '/admin/profissionais',  label: 'Profissionais' },
  { href: '/admin/reservas',       label: 'Reservas' },
  { href: '/admin/relatorios',     label: 'Relatórios' },
  { href: '/admin/configuracoes',  label: 'Configurações' },
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
    <AppShell navItems={navItems} userName={profile?.name ?? ''} role="admin" printable>
      {children}
    </AppShell>
  )
}
