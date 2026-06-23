import cron from 'node-cron'
import { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp, msgLembrete } from '../services/notifications.js'

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function sendReminders(supabase: SupabaseClient): Promise<void> {
  const tomorrow = tomorrowStr()

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('start_at, rooms(name), professionals(users(name, phone))')
    .gte('start_at', `${tomorrow}T00:00:00`)
    .lt('start_at', `${tomorrow}T23:59:59`)
    .eq('status', 'confirmed')

  if (error) {
    console.error('[cron:reminders] Erro ao buscar reservas:', error.message)
    return
  }

  for (const r of reservations ?? []) {
    const prof = (r as any).professionals?.users
    const phone: string | null = prof?.phone ?? null
    const name: string = prof?.name ?? 'Profissional'
    const room: string = (r as any).rooms?.name ?? 'Sala'

    if (phone) {
      await sendWhatsApp(phone, msgLembrete(name, room, r.start_at))
    }
  }

  console.info(`[cron:reminders] Lembretes enviados para ${tomorrow}`)
}

export function registerCronJobs(supabase: SupabaseClient): void {
  // Roda todo dia às 8h — lembra profissionais das reservas do dia seguinte
  cron.schedule(
    '0 8 * * *',
    () => {
      sendReminders(supabase).catch((e) =>
        console.error('[cron:reminders] Erro inesperado:', e),
      )
    },
    { timezone: 'America/Sao_Paulo' },
  )

  console.info('[cron] Jobs registrados — lembretes às 8h (Brasília)')
}
