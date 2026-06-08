'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'

type Reservation = {
  id: string
  start_at: string
  end_at: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  psychologists: { users: { name: string; email: string } }
  rooms: { name: string }
  patients: { name: string; phone: string | null }
}

type Psychologist = { id: string; users: { name: string } }
type Room = { id: string; name: string }

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

export default function AdminReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [psychologists, setPsychologists] = useState<Psychologist[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterPsych, setFilterPsych] = useState('')
  const [detail, setDetail] = useState<Reservation | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Psychologist[]>('/psychologists'),
      api.get<Room[]>('/rooms'),
    ]).then(([p, r]) => {
      setPsychologists(p)
      setRooms(r)
    })
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      setError(null)
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      if (filterStatus) params.set('status', filterStatus)
      if (filterRoom) params.set('room_id', filterRoom)
      if (filterPsych) params.set('psychologist_id', filterPsych)
      const qs = params.toString()
      const data = await api.get<Reservation[]>(`/reservations${qs ? `?${qs}` : ''}`)
      setReservations(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterDate, filterStatus, filterRoom, filterPsych])

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const clearFilters = () => {
    setFilterDate('')
    setFilterStatus('')
    setFilterRoom('')
    setFilterPsych('')
  }

  const hasFilters = filterDate || filterStatus || filterRoom || filterPsych

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Todas as reservas do sistema</p>
        </div>
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
        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">Todas as salas</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={filterPsych}
          onChange={(e) => setFilterPsych(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">Todos os psicólogos</option>
          {psychologists.map((p) => (
            <option key={p.id} value={p.id}>{p.users?.name}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-2">
            Limpar
          </button>
        )}
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">Psicólogo</th>
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
                  <td className="px-4 py-3 text-gray-600">{r.psychologists?.users?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.patients?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{brl(r.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetail(r)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: detalhe */}
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
                <dt className="text-gray-500">Psicólogo</dt>
                <dd className="text-gray-900">{detail.psychologists?.users?.name ?? '—'}</dd>
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
            </dl>
            <button
              onClick={() => setDetail(null)}
              className="mt-6 w-full px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
