'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'
import { Select } from '@/components/Select'

type Reservation = {
  id: string
  start_at: string
  end_at: string
  status: 'confirmed' | 'cancelled'
  professionals: { users: { name: string; email: string } }
  rooms: { name: string; number: number }
}

type Professional = { id: string; users: { name: string } }
type Room = { id: string; name: string; number: number }

const STATUS_LABEL: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const STATUS_CLASS: Record<Reservation['status'], string> = {
  confirmed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
}

export default function AdminReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterProf, setFilterProf] = useState('')

  const [detail, setDetail] = useState<Reservation | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Estado para cards mobile expansíveis
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [mobileCancelling, setMobileCancelling] = useState(false)
  const [mobileCancelError, setMobileCancelError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Professional[]>('/professionals'),
      api.get<Room[]>('/rooms'),
    ]).then(([p, r]) => { setProfessionals(p); setRooms(r) })
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      setError(null)
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      if (filterStatus) params.set('status', filterStatus)
      if (filterRoom) params.set('room_id', filterRoom)
      if (filterProf) params.set('professional_id', filterProf)
      const qs = params.toString()
      const data = await api.get<Reservation[]>(`/reservations${qs ? `?${qs}` : ''}`)
      setReservations(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterDate, filterStatus, filterRoom, filterProf])

  const handleCancelConfirm = async () => {
    if (!detail) return
    setCancelling(true)
    setCancelError(null)
    try {
      await api.post(`/reservations/${detail.id}/cancel`, {})
      setDetail(null)
      setShowConfirmCancel(false)
      load()
    } catch (e) {
      setCancelError((e as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const handleMobileCancel = async (id: string) => {
    setMobileCancelling(true)
    setMobileCancelError(null)
    try {
      await api.post(`/reservations/${id}/cancel`, {})
      setConfirmCancelId(null)
      setExpandedId(null)
      load()
    } catch (e) {
      setMobileCancelError((e as Error).message)
    } finally {
      setMobileCancelling(false)
    }
  }

  const closeModal = () => { setDetail(null); setShowConfirmCancel(false); setCancelError(null) }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const hasFilters = filterDate || filterStatus || filterRoom || filterProf

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'cancelled', label: 'Cancelada' },
  ]

  const roomOptions = [
    { value: '', label: 'Todas as salas' },
    ...rooms.map((r) => ({ value: r.id, label: r.name })),
  ]

  const profOptions = [
    { value: '', label: 'Todos os profissionais' },
    ...professionals.map((p) => ({ value: p.id, label: p.users?.name ?? '' })),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reservas</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        <Select value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
        <Select value={filterRoom} onChange={setFilterRoom} options={roomOptions} />
        <Select value={filterProf} onChange={setFilterProf} options={profOptions} />
        {hasFilters && (
          <button
            onClick={() => { setFilterDate(''); setFilterStatus(''); setFilterRoom(''); setFilterProf('') }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2"
          >
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : reservations.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma reserva encontrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Mobile: cards expansíveis */}
          <div className="sm:hidden divide-y divide-gray-100">
            {reservations.map((r) => (
              <div key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (expandedId === r.id) {
                      setExpandedId(null)
                    } else {
                      setExpandedId(r.id)
                      setConfirmCancelId(null)
                      setMobileCancelError(null)
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{fmt(r.start_at)}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedId === r.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedId === r.id && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50/50 space-y-3">
                    {confirmCancelId !== r.id ? (
                      <>
                        <dl className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Sala</dt>
                            <dd className="text-gray-900 font-medium">{r.rooms?.name ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Status</dt>
                            <dd>
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                                {STATUS_LABEL[r.status]}
                              </span>
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Profissional</dt>
                            <dd className="text-gray-900 font-medium">{r.professionals?.users?.name ?? '—'}</dd>
                          </div>
                        </dl>
                        {r.status === 'confirmed' && (
                          <button
                            onClick={() => { setConfirmCancelId(r.id); setMobileCancelError(null) }}
                            className="w-full py-2.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Cancelar reserva
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">Confirmar cancelamento?</p>
                        {mobileCancelError && (
                          <p className="text-xs text-red-600">{mobileCancelError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setConfirmCancelId(null); setMobileCancelError(null) }}
                            disabled={mobileCancelling}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          >
                            Voltar
                          </button>
                          <button
                            onClick={() => handleMobileCancel(r.id)}
                            disabled={mobileCancelling}
                            className="flex-1 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {mobileCancelling ? 'Cancelando...' : 'Confirmar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Data / Hora</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Sala</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Profissional</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmt(r.start_at)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.rooms?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.professionals?.users?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setDetail(r); setCancelError(null); setShowConfirmCancel(false) }}
                        className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal desktop */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Detalhe da reserva</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Data / Hora</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-medium">{fmt(detail.start_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Sala</dt>
                <dd className="text-gray-900 dark:text-gray-100">{detail.rooms?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Profissional</dt>
                <dd className="text-gray-900 dark:text-gray-100">{detail.professionals?.users?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[detail.status]}`}>
                    {STATUS_LABEL[detail.status]}
                  </span>
                </dd>
              </div>
            </dl>

            {!showConfirmCancel && (
              <div className="mt-6 space-y-2">
                {detail.status === 'confirmed' && (
                  <button
                    onClick={() => setShowConfirmCancel(true)}
                    className="w-full px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Cancelar reserva
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Fechar
                </button>
              </div>
            )}

            {showConfirmCancel && (
              <div className="mt-6">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Confirmar cancelamento desta reserva?
                  <br />
                  <span className="text-gray-500 dark:text-gray-400 text-xs mt-1 block">
                    Como administrador, você pode cancelar a qualquer momento.
                  </span>
                </p>
                {cancelError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                    {cancelError}
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    onClick={handleCancelConfirm}
                    disabled={cancelling}
                    className="w-full px-4 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                  <button
                    onClick={() => { setShowConfirmCancel(false); setCancelError(null) }}
                    disabled={cancelling}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
