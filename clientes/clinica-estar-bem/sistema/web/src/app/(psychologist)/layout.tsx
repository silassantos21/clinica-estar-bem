import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/AppShell'

const navItems = [
  { href: '/psicologo/dashboard', label: 'Minha agenda' },
  { href: '/psicologo/reservas',  label: 'Reservas' },
  { href: '/psicologo/perfil',    label: 'Perfil' },
]

export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'professional') redirect('/admin/dashboard')

  return (
    <AppShell navItems={navItems} userName={profile?.name ?? ''} role="professional">
      {children}
    </AppShell>
  )
}
