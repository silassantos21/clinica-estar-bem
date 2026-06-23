'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'
import { Select } from '@/components/Select'

type Reservation = {
  id: string
  start_at: string
  end_at: string
  status: 'confirmed' | 'cancelled'
  rooms: { name: string; number: number }
}

const STATUS_LABEL: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const STATUS_CLASS: Record<Reservation['status'], string> = {
  confirmed: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
}

const TOLERANCE_HOURS = 5

export default function ReservasProfissionalPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')

  // Modal desktop
  const [detail, setDetail] = useState<Reservation | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)

  // Cards mobile expansíveis
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [mobileCancelling, setMobileCancelling] = useState(false)
  const [mobileCancelError, setMobileCancelError] = useState<string | null>(null)

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

  const hoursUntil = (r: Reservation) =>
    (new Date(r.start_at).getTime() - Date.now()) / (1000 * 60 * 60)

  const canCancel = (r: Reservation) =>
    r.status === 'confirmed' && hoursUntil(r) >= TOLERANCE_HOURS

  const cancelBlockedMsg = (r: Reservation) => {
    if (r.status !== 'confirmed') return null
    const h = hoursUntil(r)
    if (h <= 0 || h >= TOLERANCE_HOURS) return null
    return `Cancelamento encerrado — faltam menos de ${TOLERANCE_HOURS}h para o horário`
  }

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

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'cancelled', label: 'Cancelada' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reservas</h1>
        <Link
          href="/psicologo/reservas/nova"
          title="Nova reserva"
          className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Nova reserva</span>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <DatePicker value={filterDate} onChange={setFilterDate} placeholder="Filtrar por data" />
        <Select value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
        {(filterStatus || filterDate) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterDate('') }}
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
          <Link
            href="/psicologo/reservas/nova"
            className="inline-block mt-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Fazer nova reserva
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards expansíveis */}
          <div className="sm:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
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
                        </dl>
                        {r.status === 'confirmed' && hoursUntil(r) > 0 && (
                          <>
                            <button
                              onClick={() => canCancel(r) && setConfirmCancelId(r.id)}
                              disabled={!canCancel(r)}
                              className={`w-full py-2.5 text-sm rounded-lg transition-colors ${
                                canCancel(r)
                                  ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                  : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              Cancelar reserva
                            </button>
                            {cancelBlockedMsg(r) && (
                              <p className="text-xs text-gray-400 text-center">{cancelBlockedMsg(r)}</p>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700">Tem certeza que deseja cancelar?</p>
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
          <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Data / Hora</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Sala</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fmt(r.start_at)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.rooms?.name ?? '—'}</td>
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
        </>
      )}

      {/* Modal desktop */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-6 pb-8 sm:pb-6">
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
                {detail.status === 'confirmed' && hoursUntil(detail) > 0 && (
                  <>
                    <button
                      onClick={() => canCancel(detail) && setShowConfirmCancel(true)}
                      disabled={!canCancel(detail)}
                      className={`w-full px-4 py-3 min-h-[44px] border text-sm rounded-lg transition-colors ${
                        canCancel(detail)
                          ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      Cancelar reserva
                    </button>
                    {cancelBlockedMsg(detail) && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-1">
                        {cancelBlockedMsg(detail)}
                      </p>
                    )}
                  </>
                )}
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-3 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Fechar
                </button>
              </div>
            )}

            {showConfirmCancel && (
              <div className="mt-6">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Tem certeza que deseja cancelar esta reserva?
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
                    className="w-full px-4 py-3 min-h-[44px] bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                  <button
                    onClick={() => { setShowConfirmCancel(false); setCancelError(null) }}
                    disabled={cancelling}
                    className="w-full px-4 py-3 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
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
