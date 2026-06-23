'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type Reservation = {
  id: string
  start_at: string
  end_at: string
  status: 'confirmed' | 'cancelled'
  rooms: { name: string; number: number }
}

type Me = { name: string }

export default function ProfessionalDashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [today, setToday] = useState<Reservation[]>([])
  const [upcoming, setUpcoming] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now = new Date()
        const todayIso = now.toISOString().split('T')[0]

        const [meData, todayData, allData] = await Promise.all([
          api.get<Me>('/me'),
          api.get<Reservation[]>(`/reservations?date=${todayIso}`),
          api.get<Reservation[]>('/reservations'),
        ])

        setMe(meData)
        setToday(todayData.filter((r) => r.status === 'confirmed'))

        const todayEnd = new Date(todayIso + 'T23:59:59')
        setUpcoming(
          allData
            .filter((r) => new Date(r.start_at) > todayEnd && r.status === 'confirmed')
            .slice(0, 5),
        )
      } catch {
        // falha silenciosa
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-gray-400 dark:text-gray-500 capitalize">{todayLabel}</p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
          {loading ? 'Carregando...' : `Olá, ${me?.name?.split(' ')[0] ?? 'Profissional'}`}
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Carregando agenda...</p>
      ) : (
        <div className="space-y-6">
          {/* Agenda de hoje */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hoje</h2>
              <Link href="/psicologo/reservas" className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Ver todas →
              </Link>
            </div>

            {today.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma reserva hoje.</p>
                <Link
                  href="/psicologo/reservas/nova"
                  className="mt-3 inline-block text-sm font-medium text-gray-900 dark:text-gray-100 underline"
                >
                  Fazer nova reserva
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {today.map((r) => (
                  <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
                    <div className="shrink-0 text-center w-14">
                      <div className="text-base font-bold text-gray-900 dark:text-gray-100">{fmtTime(r.start_at)}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{fmtTime(r.end_at)}</div>
                    </div>
                    <div className="h-10 w-px bg-gray-100 dark:bg-gray-800 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{r.rooms?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Reserva confirmada</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Próximas reservas */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Próximas reservas</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {upcoming.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 w-20 capitalize">
                      {fmtDate(r.start_at)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 w-14 shrink-0">{fmtTime(r.start_at)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">{r.rooms?.name ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Atalhos */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Atalhos</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/psicologo/reservas/nova"
                className="bg-brand-600 text-white rounded-xl p-4 hover:bg-brand-700 transition-colors"
              >
                <div className="text-sm font-semibold">Nova reserva</div>
                <div className="text-xs text-brand-200 mt-0.5">Agendar uma sala</div>
              </Link>
              <Link
                href="/psicologo/reservas"
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Minhas reservas</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Ver histórico</div>
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
