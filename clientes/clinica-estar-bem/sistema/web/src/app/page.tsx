import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Rota raiz: redireciona pro dashboard correto conforme o role
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin/dashboard')
  if (profile?.role === 'psychologist') redirect('/psicologo/dashboard')

  redirect('/login')
}
