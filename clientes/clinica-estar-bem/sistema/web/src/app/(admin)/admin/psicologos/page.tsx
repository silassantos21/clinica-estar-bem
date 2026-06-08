'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type UserRow = { id: string; name: string; email: string; phone: string | null; active: boolean }
type Psychologist = { id: string; crp: string | null; penalty_split_rate: number; users: UserRow }
type RoomWithRate = {
  id: string
  name: string
  floor: string | null
  hourly_rate: number
  custom_rate: number | null
  effective_rate: number
}

// ── Modal de tarifas customizadas ────────────────────────────────────────────

function TarifasModal({ psych, onClose }: { psych: Psychologist; onClose: () => void }) {
  const [rooms, setRooms] = useState<RoomWithRate[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const data = await api.get<RoomWithRate[]>(`/psychologists/${psych.id}/rooms`)
    setRooms(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [psych.id])

  const save = async (roomId: string) => {
    setSaving((s) => ({ ...s, [roomId]: true }))
    try {
      const raw = draft[roomId]
      const custom_rate = raw === '' ? null : Number(raw)
      await api.put(`/psychologists/${psych.id}/rooms/${roomId}`, { custom_rate })
      await load()
      setDraft((d) => { const n = { ...d }; delete n[roomId]; return n })
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving((s) => ({ ...s, [roomId]: false }))
    }
  }

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tarifas customizadas</h2>
            <p className="text-sm text-gray-500 mt-0.5">{psych.users.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Carregando...</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhuma sala disponível.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left font-medium text-gray-500">Sala</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Padrão</th>
                  <th className="pb-2 text-left font-medium text-gray-500 pl-2">Customizada (R$)</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rooms.map((room) => {
                  const currentVal = draft[room.id] ?? (room.custom_rate !== null ? String(room.custom_rate) : '')
                  const isDirty = draft[room.id] !== undefined
                  return (
                    <tr key={room.id}>
                      <td className="py-3 text-gray-900">{room.name}</td>
                      <td className="py-3 text-gray-500">{brl(room.hourly_rate)}</td>
                      <td className="py-3 pl-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentVal}
                          placeholder="Tarifa padrão"
                          onChange={(e) => setDraft((d) => ({ ...d, [room.id]: e.target.value }))}
                          className="w-28 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                        />
                      </td>
                      <td className="py-3 text-right">
                        {isDirty && (
                          <button
                            onClick={() => save(room.id)}
                            disabled={saving[room.id]}
                            className="text-xs font-medium text-gray-900 hover:underline disabled:opacity-50"
                          >
                            {saving[room.id] ? 'Salvando...' : 'Salvar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-400">Deixe em branco para usar a tarifa padrão da sala.</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Formulário de criação / edição ───────────────────────────────────────────

type PsychForm = {
  name: string
  email: string
  password: string
  phone: string
  crp: string
  penalty_split_rate: string
  active: boolean
}
const emptyForm: PsychForm = {
  name: '', email: '', password: '', phone: '', crp: '', penalty_split_rate: '50', active: true,
}

function PsychForm({
  psych,
  onClose,
  onSaved,
}: {
  psych: Psychologist | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PsychForm>(() =>
    psych
      ? {
          name: psych.users.name,
          email: psych.users.email,
          password: '',
          phone: psych.users.phone ?? '',
          crp: psych.crp ?? '',
          penalty_split_rate: String(Math.round(psych.penalty_split_rate * 100)),
          active: psych.users.active,
        }
      : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const set = (k: keyof PsychForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: form.name,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
        phone: form.phone || null,
        crp: form.crp || null,
        penalty_split_rate: Number(form.penalty_split_rate) / 100,
        active: form.active,
      }
      if (psych) {
        await api.put(`/psychologists/${psych.id}`, body)
      } else {
        if (!form.password) { alert('Informe uma senha.'); return }
        await api.post('/psychologists', body)
      }
      onSaved()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          {psych ? 'Editar psicólogo' : 'Novo psicólogo'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input type="text" required value={form.name} onChange={set('name')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required={!psych} disabled={!!psych} value={form.email} onChange={set('email')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            {!psych && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
                <input type="password" required value={form.password} onChange={set('password')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="text" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CRP</label>
              <input type="text" value={form.crp} onChange={set('crp')} placeholder="06/12345"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Split de penalidade (%)
              </label>
              <input type="number" min="0" max="100" step="1" value={form.penalty_split_rate}
                onChange={set('penalty_split_rate')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
              <p className="text-xs text-gray-400 mt-1">
                Percentual que o psicólogo recebe em cancelamentos com penalidade.
              </p>
            </div>
            {psych && (
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active}
                  onChange={set('active')} className="rounded border-gray-300" />
                <label htmlFor="active" className="text-sm text-gray-700">Psicólogo ativo</label>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function PsicologosPage() {
  const [psychologists, setPsychologists] = useState<Psychologist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<Psychologist | null | 'new'>(undefined as unknown as null)
  const [showForm, setShowForm] = useState(false)
  const [tarifasTarget, setTarifasTarget] = useState<Psychologist | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await api.get<Psychologist[]>('/psychologists')
      setPsychologists(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setFormTarget(null); setShowForm(true) }
  const openEdit = (p: Psychologist) => { setFormTarget(p); setShowForm(true) }
  const closeForm = () => setShowForm(false)
  const handleSaved = () => { closeForm(); load() }

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Psicólogos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão e acessos</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
        >
          Novo psicólogo
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : psychologists.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">Nenhum psicólogo cadastrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">CRP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Split %</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {psychologists.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.users.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.users.email}</td>
                  <td className="px-4 py-3 text-gray-600">{p.crp ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{pct(p.penalty_split_rate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.users.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.users.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => setTarifasTarget(p)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Tarifas
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PsychForm psych={formTarget as Psychologist | null} onClose={closeForm} onSaved={handleSaved} />
      )}

      {tarifasTarget && (
        <TarifasModal psych={tarifasTarget} onClose={() => setTarifasTarget(null)} />
      )}
    </div>
  )
}
