'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Repasse = {
  id: string
  amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  notes: string | null
  reservations: {
    start_at: string
    total_amount: number
    rooms: { name: string }
    patients: { name: string }
  }
}

const STATUS_LABEL: Record<Repasse['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
}

const STATUS_CLASS: Record<Repasse['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  paid: 'bg-green-50 text-green-700',
}

export default function PsicologoRepassesPage() {
  const [repasses, setRepasses] = useState<Repasse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPatient, setFilterPatient] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setError(null)
      const qs = filterStatus ? `?status=${filterStatus}` : ''
      const data = await api.get<Repasse[]>(`/repasses${qs}`)
      setRepasses(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus])

  const filtered = repasses.filter((r) =>
    !filterPatient ||
    r.reservations?.patients?.name?.toLowerCase().includes(filterPatient.toLowerCase()),
  )

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

  const paidTotal = repasses
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meus repasses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Valores a receber da clínica</p>
        </div>
      </div>

      {/* Resumo */}
      {repasses.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">A receber</p>
            <p className="text-2xl font-semibold text-yellow-600 mt-2">{brl(pendingTotal)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Já recebido</p>
            <p className="text-2xl font-semibold text-green-700 mt-2">{brl(paidTotal)}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        >
          <option value="">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos</option>
        </select>
        <input
          type="text"
          value={filterPatient}
          onChange={(e) => setFilterPatient(e.target.value)}
          placeholder="Filtrar por paciente..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/20 w-52"
        />
        {(filterStatus || filterPatient) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPatient('') }}
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
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhum repasse encontrado.</p>
          {repasses.length === 0 && (
            <p className="text-gray-400 text-xs mt-1">
              Os repasses aparecem após a clínica confirmar uma sessão concluída ou ao aplicar uma penalidade por cancelamento.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sessão</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Paciente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Sala</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Pago em</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {r.reservations?.start_at ? fmt(r.reservations.start_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.reservations?.patients?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.reservations?.rooms?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium text-right">{brl(r.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {r.paid_at ? fmtDate(r.paid_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                    {r.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
