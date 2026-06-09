'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type FinancialReport = {
  month: number
  year: number
  receita_bruta: number
  total_retido: number
  total_reembolsado: number
  repasses_pagos: number
  repasses_pendentes: number
  count_repasses_pendentes: number
}

type RoomReport = {
  room_id: string
  room_name: string
  available_hours: number
  used_hours: number
  occupancy_rate: number
}

type PsychReport = {
  psychologist_id: string
  name: string
  total_reservations: number
  completed: number
  cancelled: number
  no_shows: number
  receita: number
  repasses_pendentes: number
  repasses_pagos: number
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function RelatoriosPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const [financial, setFinancial] = useState<FinancialReport | null>(null)
  const [rooms, setRooms] = useState<RoomReport[]>([])
  const [psychologists, setPsychologists] = useState<PsychReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
      const nextMonthDate = new Date(year, month, 1)
      const lastDay = nextMonthDate.toISOString().split('T')[0]

      const [fin, rm, psych] = await Promise.all([
        api.get<FinancialReport>(`/reports/financial?month=${month}&year=${year}`),
        api.get<{ rooms: RoomReport[] }>(`/reports/rooms?start=${firstDay}&end=${lastDay}`),
        api.get<{ psychologists: PsychReport[] }>(`/reports/psychologists?start=${firstDay}&end=${lastDay}`),
      ])
      setFinancial(fin)
      setRooms(rm.rooms)
      setPsychologists(psych.psychologists)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month, year])

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Financeiro, ocupação e desempenho</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">

          {/* Financeiro */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Financeiro — {MONTHS[month - 1]} {year}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard label="Receita bruta" value={brl(financial?.receita_bruta ?? 0)} />
              <MetricCard label="Total retido (no-show/penalidade)" value={brl(financial?.total_retido ?? 0)} />
              <MetricCard label="Total reembolsado" value={brl(financial?.total_reembolsado ?? 0)} />
              <MetricCard
                label="Repasses pagos"
                value={brl(financial?.repasses_pagos ?? 0)}
                accent="green"
              />
              <MetricCard
                label="Repasses pendentes"
                value={brl(financial?.repasses_pendentes ?? 0)}
                sub={financial?.count_repasses_pendentes ? `${financial.count_repasses_pendentes} repasse(s)` : undefined}
                accent={financial?.count_repasses_pendentes ? 'yellow' : undefined}
              />
            </div>
          </section>

          {/* Ocupação por sala */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ocupação por sala</h2>
            {rooms.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma sala ativa.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Sala</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Horas disponíveis</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Horas usadas</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-48">Ocupação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rooms.map((r) => (
                      <tr key={r.room_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{r.room_name}</td>
                        <td className="px-4 py-3 text-gray-600 text-right">{r.available_hours}h</td>
                        <td className="px-4 py-3 text-gray-600 text-right">{r.used_hours}h</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-brand-600 rounded-full h-2"
                                style={{ width: `${Math.min(100, r.occupancy_rate)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{r.occupancy_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Por psicólogo */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Por psicólogo</h2>
            {psychologists.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum psicólogo cadastrado.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Psicólogo</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Reservas</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Concluídas</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Canceladas</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Ausências</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Receita</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Rep. pendentes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {psychologists.map((p) => (
                      <tr key={p.psychologist_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-600 text-right">{p.total_reservations}</td>
                        <td className="px-4 py-3 text-gray-600 text-right">{p.completed}</td>
                        <td className="px-4 py-3 text-gray-600 text-right">{p.cancelled}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={p.no_shows > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {p.no_shows}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 text-right font-medium">{brl(p.receita)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={p.repasses_pendentes > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                            {brl(p.repasses_pendentes)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'yellow'
}) {
  const valueClass =
    accent === 'green'
      ? 'text-green-700'
      : accent === 'yellow'
      ? 'text-yellow-700'
      : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-2 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
