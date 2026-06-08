'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type Reservation = {
  id: string
  start_at: string
  end_at: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  rooms: { name: string }
  patients: { name: string; phone: string | null }
}

type Me = { name: string }

const STATUS_LABEL: Record<Reservation['status'], string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
  no_show: 'No-show',
}

const STATUS_CLASS: Record<Reservation['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-blue-50 text-blue-700',
  no_show: 'bg-red-50 text-red-600',
}

export default function PsicologoDashboard() {
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
        setToday(todayData.filter((r) => r.status !== 'cancelled'))

        const todayEnd = new Date(todayIso + 'T23:59:59')
        setUpcoming(
          allData
            .filter((r) => new Date(r.start_at) > todayEnd && r.status !== 'cancelled')
            .slice(0, 5),
        )
      } catch {
        // falha silenciosa — página mostra estado vazio
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

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-gray-400 capitalize">{todayLabel}</p>
        <h1 className="text-2xl font-semibold text-gray-900 mt-0.5">
          {loading ? 'Carregando...' : `Olá, ${me?.name?.split(' ')[0] ?? 'Psicólogo'}`}
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando agenda...</p>
      ) : (
        <div className="space-y-6">
          {/* Agenda de hoje */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Hoje</h2>
              <Link href="/psicologo/reservas" className="text-xs font-medium text-gray-500 hover:text-gray-900">
                Ver todas →
              </Link>
            </div>

            {today.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">Nenhuma sessão hoje.</p>
                <Link
                  href="/psicologo/reservas/nova"
                  className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
                >
                  Criar reserva
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {today.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-4">
                    <div className="shrink-0 text-center w-14">
                      <div className="text-base font-bold text-gray-900">{fmtTime(r.start_at)}</div>
                      <div className="text-xs text-gray-400">{fmtTime(r.end_at)}</div>
                    </div>
                    <div className="h-10 w-px bg-gray-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{r.patients?.name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{r.rooms?.name}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">{brl(r.total_amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Próximas sessões */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximas sessões</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {upcoming.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0 text-xs font-medium text-gray-500 w-20 capitalize">
                      {fmtDate(r.start_at)}
                    </div>
                    <div className="text-xs text-gray-400 w-14 shrink-0">{fmtTime(r.start_at)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{r.patients?.name ?? '—'}</span>
                    </div>
                    <div className="shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Atalhos */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Atalhos</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/psicologo/reservas/nova"
                className="bg-brand-600 text-white rounded-xl p-4 hover:bg-brand-700 transition-colors"
              >
                <div className="text-sm font-semibold">Nova reserva</div>
                <div className="text-xs text-gray-400 mt-0.5">Agendar uma sala</div>
              </Link>
              <Link
                href="/psicologo/pacientes"
                className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-semibold text-gray-900">Pacientes</div>
                <div className="text-xs text-gray-400 mt-0.5">Ver e cadastrar</div>
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
