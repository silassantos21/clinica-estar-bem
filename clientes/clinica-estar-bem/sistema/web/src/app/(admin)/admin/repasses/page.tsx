'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Repasse = {
  id: string
  amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  notes: string | null
  psychologists: { users: { name: string } }
  reservations: {
    start_at: string
    total_amount: number
    rooms: { name: string }
    patients: { name: string }
  }
}

type Psychologist = { id: string; users: { name: string } }

const STATUS_LABEL: Record<Repasse['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
}

const STATUS_CLASS: Record<Repasse['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  paid: 'bg-green-50 text-green-700',
}

export default function AdminRepassesPage() {
  const [repasses, setRepasses] = useState<Repasse[]>([])
  const [psychologists, setPsychologists] = useState<Psychologist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPsych, setFilterPsych] = useState('')

  // Modal de pagamento
  const [paying, setPaying] = useState<Repasse | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get<Psychologist[]>('/psychologists').then(setPsychologists).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      setError(null)
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterPsych) params.set('psychologist_id', filterPsych)
      const qs = params.toString()
      const data = await api.get<Repasse[]>(`/repasses${qs ? `?${qs}` : ''}`)
      setRepasses(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus, filterPsych])

  const openPay = (repasse: Repasse) => {
    setPaying(repasse)
    setNotes('')
  }

  const handlePay = async () => {
    if (!paying) return
    setSubmitting(true)
    try {
      await api.put(`/repasses/${paying.id}/pay`, { notes: notes.trim() || undefined })
      setPaying(null)
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const pendingTotal = repasses
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Repasses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Valores a pagar aos psicólogos</p>
        </div>
        {pendingTotal > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm">
            <span className="text-yellow-600 font-medium">{brl(pendingTotal)}</span>
            <span className="text-yellow-700 ml-1">pendentes</span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
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
        {(filterStatus || filterPsych) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPsych('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : repasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhum repasse encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Psicólogo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sessão</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Paciente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sala</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Pago em</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {repasses.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {r.psychologists?.users?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.reservations?.start_at ? fmt(r.reservations.start_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.reservations?.patients?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.reservations?.rooms?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{brl(r.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {r.paid_at ? fmtDate(r.paid_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => openPay(r)}
                        className="text-xs font-medium text-gray-900 border border-gray-200 rounded px-2.5 py-1 hover:bg-gray-50"
                      >
                        Marcar como pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal confirmar pagamento */}
      {paying && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirmar pagamento</h2>
            <p className="text-sm text-gray-500 mb-5">
              {paying.psychologists?.users?.name ?? '—'} · {brl(paying.amount)}
            </p>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observação <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: transferência Pix, número do comprovante..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handlePay}
                disabled={submitting}
                className="w-full px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Confirmando...' : 'Confirmar pagamento'}
              </button>
              <button
                onClick={() => setPaying(null)}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
