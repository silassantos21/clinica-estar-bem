'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'

type Payment = {
  id: string
  status: 'pending' | 'paid' | 'refunded' | 'retained'
  payment_link_url: string | null
}

type Reservation = {
  id: string
  start_at: string
  end_at: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  rooms: { name: string }
  patients: { name: string; phone: string | null }
  payments: Payment[]
}

const STATUS_LABEL: Record<Reservation['status'], string> = {
  pending: 'Pendente',
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

const PAYMENT_STATUS_LABEL: Record<Payment['status'], string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  refunded: 'Reembolsado',
  retained: 'Retido',
}

const PAYMENT_STATUS_CLASS: Record<Payment['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  paid: 'bg-green-50 text-green-700',
  refunded: 'bg-gray-100 text-gray-500',
  retained: 'bg-red-50 text-red-600',
}

export default function ReservasPsicologoPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [detail, setDetail] = useState<Reservation | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterDate) params.set('date', filterDate)
      const qs = params.toString()
      const data = await api.get<Reservation[]>(`/reservations${qs ? `?${qs}` : ''}`)
      setReservations(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus, filterDate])

  const handleConfirmTest = async (reservation: Reservation) => {
    try {
      setPayingId(reservation.id)
      await api.post(`/reservations/${reservation.id}/confirm-test`, {})
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPayingId(null)
    }
  }

  const handlePay = async (reservation: Reservation) => {
    const existing = reservation.payments?.[0]
    if (existing?.payment_link_url) {
      window.open(existing.payment_link_url, '_blank')
      return
    }
    try {
      setPayingId(reservation.id)
      const data = await api.post<{ payment_link_url: string }>(`/reservations/${reservation.id}/payment`, {})
      window.open(data.payment_link_url, '_blank')
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPayingId(null)
    }
  }

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suas reservas de sala</p>
        </div>
        <Link
          href="/psicologo/reservas/nova"
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          Nova reserva
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmada</option>
          <option value="cancelled">Cancelada</option>
          <option value="completed">Concluída</option>
          <option value="no_show">No-show</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhuma reserva encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Data / Hora</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sala</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Paciente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{fmt(r.start_at)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.rooms?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.patients?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{brl(r.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === 'pending' && process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={() => handleConfirmTest(r)}
                          disabled={payingId === r.id}
                          className="text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title="Confirmar sem pagamento (só em dev)"
                        >
                          [dev] confirmar
                        </button>
                      )}
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handlePay(r)}
                          disabled={payingId === r.id}
                          className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:opacity-50"
                        >
                          {payingId === r.id ? 'Gerando...' : 'Pagar'}
                        </button>
                      )}
                      <button
                        onClick={() => setDetail(r)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: detalhe da reserva */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalhe da reserva</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Data / Hora</dt>
                <dd className="text-gray-900 font-medium">{fmt(detail.start_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Sala</dt>
                <dd className="text-gray-900">{detail.rooms?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Paciente</dt>
                <dd className="text-gray-900">{detail.patients?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Telefone</dt>
                <dd className="text-gray-900">{detail.patients?.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Valor</dt>
                <dd className="text-gray-900 font-medium">{brl(detail.total_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[detail.status]}`}>
                    {STATUS_LABEL[detail.status]}
                  </span>
                </dd>
              </div>
              {detail.payments?.[0] && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Pagamento</dt>
                  <dd>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_CLASS[detail.payments[0].status]}`}>
                      {PAYMENT_STATUS_LABEL[detail.payments[0].status]}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-6 space-y-2">
              {detail.status === 'pending' && (
                <button
                  onClick={() => handlePay(detail)}
                  disabled={payingId === detail.id}
                  className="w-full px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {payingId === detail.id ? 'Gerando link...' : 'Pagar agora'}
                </button>
              )}
              <button
                onClick={() => setDetail(null)}
                className="w-full px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
