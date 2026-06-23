'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type Reservation = { id: string; status: string; start_at: string }

export default function AdminDashboard() {
  const [todayCount, setTodayCount] = useState<number | null>(null)
  const [totalMonth, setTotalMonth] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

        const [todayRes, monthRes] = await Promise.all([
          api.get<Reservation[]>(`/reservations?date=${today}`),
          api.get<Reservation[]>(`/reservations`),
        ])

        setTodayCount(todayRes.filter((r) => r.status === 'confirmed').length)
        setTotalMonth(
          monthRes.filter(
            (r) => r.status === 'confirmed' && r.start_at >= firstDay,
          ).length,
        )
      } catch {
        // falha silenciosa
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Reservas hoje', value: loading ? '—' : String(todayCount ?? 0), link: '/admin/reservas' },
    { label: 'Reservas no mês', value: loading ? '—' : String(totalMonth ?? 0), link: '/admin/reservas' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Visão geral</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        {new Date().toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.label} href={card.link}>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl font-semibold mt-2 text-gray-900 dark:text-gray-100">{card.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/reservas"
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ver reservas</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Todas as reservas do sistema</div>
        </Link>
        <Link
          href="/admin/profissionais"
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profissionais</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cadastrar e gerenciar</div>
        </Link>
      </div>
    </div>
  )
}
