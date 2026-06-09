'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type FinancialReport = {
  receita_bruta: number
  repasses_pendentes: number
  count_repasses_pendentes: number
}

type RoomReport = {
  rooms: { available_hours: number; used_hours: number }[]
}

type Reservation = {
  id: string
  start_at: string
  status: string
}

export default function AdminDashboard() {
  const [financial, setFinancial] = useState<FinancialReport | null>(null)
  const [todayCount, setTodayCount] = useState<number | null>(null)
  const [occupancy, setOccupancy] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
        const nextMonthDate = new Date(year, month, 1)
        const lastDay = nextMonthDate.toISOString().split('T')[0]

        const [fin, rm, todayRes] = await Promise.all([
          api.get<FinancialReport>(`/reports/financial?month=${month}&year=${year}`),
          api.get<RoomReport>(`/reports/rooms?start=${firstDay}&end=${lastDay}`),
          api.get<Reservation[]>(`/reservations?date=${today}`),
        ])

        setFinancial(fin)

        const totalUsed = rm.rooms.reduce((s, r) => s + r.used_hours, 0)
        const totalAvail = rm.rooms.reduce((s, r) => s + r.available_hours, 0)
        setOccupancy(totalAvail > 0 ? parseFloat(((totalUsed / totalAvail) * 100).toFixed(1)) : 0)

        setTodayCount(todayRes.filter((r) => !['cancelled', 'no_show'].includes(r.status)).length)
      } catch {
        // falha silenciosa
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const cards = [
    {
      label: 'Reservas hoje',
      value: loading ? '—' : String(todayCount ?? 0),
      link: '/admin/reservas',
    },
    {
      label: 'Receita do mês',
      value: loading ? '—' : brl(financial?.receita_bruta ?? 0),
      link: '/admin/relatorios',
    },
    {
      label: 'Repasses pendentes',
      value: loading ? '—' : brl(financial?.repasses_pendentes ?? 0),
      sub: financial?.count_repasses_pendentes
        ? `${financial.count_repasses_pendentes} repasse(s)`
        : undefined,
      link: '/admin/repasses',
      accent: financial?.count_repasses_pendentes ? 'yellow' : undefined,
    },
    {
      label: 'Taxa de ocupação',
      value: loading ? '—' : `${occupancy ?? 0}%`,
      sub: 'no mês',
      link: '/admin/relatorios',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Visão geral</h1>
      <p className="text-sm text-gray-500 mb-8">
        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.link}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors cursor-pointer">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p
                className={`text-2xl font-semibold mt-2 ${
                  card.accent === 'yellow' ? 'text-yellow-600' : 'text-gray-900'
                }`}
              >
                {card.value}
              </p>
              {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
