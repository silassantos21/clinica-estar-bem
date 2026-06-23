// Notificações via WhatsApp (Baileys)
// Fire-and-forget: erros são logados mas NUNCA propagados para o caller

import { sendWA } from './whatsapp.js'

function fmtDateTime(startAt: string): { date: string; time: string } {
  // startAt = "YYYY-MM-DDTHH:MM:SS" — parse manual para evitar conversão de timezone
  const [datePart, timePart] = startAt.split('T')
  const [y, m, d] = datePart.split('-')
  const [h, min] = timePart.split(':')
  return { date: `${d}/${m}/${y}`, time: `${h}:${min}` }
}

export async function sendWhatsApp(
  phone: string | null | undefined,
  message: string,
): Promise<void> {
  await sendWA(phone, message)
}

export function msgConfirmacao(name: string, room: string, startAt: string): string {
  const { date, time } = fmtDateTime(startAt)
  return (
    `Olá, ${name}! ✅ Sua reserva foi confirmada.\n\n` +
    `📍 ${room}\n` +
    `📅 ${date} às ${time}\n\n` +
    `_Núcleo Estar Bem_`
  )
}

export function msgCancelamento(name: string, room: string, startAt: string): string {
  const { date, time } = fmtDateTime(startAt)
  return (
    `Olá, ${name}. ❌ Sua reserva foi cancelada.\n\n` +
    `📍 ${room}\n` +
    `📅 ${date} às ${time}\n\n` +
    `_Núcleo Estar Bem_`
  )
}

export function msgLembrete(name: string, room: string, startAt: string): string {
  const { date, time } = fmtDateTime(startAt)
  return (
    `Olá, ${name}! 🔔 Lembrete de reserva para amanhã.\n\n` +
    `📍 ${room}\n` +
    `📅 ${date} às ${time}\n\n` +
    `_Núcleo Estar Bem_`
  )
}
