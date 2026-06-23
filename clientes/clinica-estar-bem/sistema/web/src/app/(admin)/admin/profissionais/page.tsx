'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type UserRow = { id: string; name: string; email: string; phone: string | null; active: boolean }
type Professional = { id: string; created_at: string; users: UserRow }

type ProfForm = {
  name: string
  email: string
  password: string
  phone: string
  active: boolean
}

const emptyForm: ProfForm = { name: '', email: '', password: '', phone: '', active: true }

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

const maskPhone = (val: string) => {
  const d = val.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}

function ProfessionalForm({
  prof, onClose, onSaved,
}: {
  prof: Professional | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProfForm>(() =>
    prof
      ? { name: prof.users.name, email: prof.users.email, password: '', phone: prof.users.phone ?? '', active: prof.users.active }
      : emptyForm,
  )
  const [touched, setTouched] = useState<Partial<Record<keyof ProfForm, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const touch = (k: keyof ProfForm) => setTouched((t) => ({ ...t, [k]: true }))

  const errors: Partial<Record<keyof ProfForm, string>> = {}
  if (touched.name && !form.name.trim()) errors.name = 'Nome obrigatório'
  if (!prof) {
    if (touched.email && !form.email) errors.email = 'Email obrigatório'
    else if (touched.email && !isValidEmail(form.email)) errors.email = 'Email inválido'
  }
  if (!prof && touched.password && !form.password) errors.password = 'Senha obrigatória'
  if (!prof && touched.password && form.password && form.password.length < 6) errors.password = 'Mínimo de 6 caracteres'

  const inputClass = (field: keyof ProfForm) =>
    `w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors ${
      errors[field]
        ? 'border-red-400 dark:border-red-600 focus:ring-red-200 dark:focus:ring-red-800'
        : 'border-gray-200 dark:border-gray-700 focus:ring-gray-900/20 dark:focus:ring-gray-100/20'
    }`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, phone: true, active: true })
    if (Object.keys(errors).length > 0) return
    if (!prof && !form.password) return
    setServerError(null)
    setSaving(true)
    try {
      const body = {
        name: form.name,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
        phone: form.phone || null,
        active: form.active,
      }
      if (prof) {
        await api.put(`/professionals/${prof.id}`, body)
      } else {
        await api.post('/professionals', body)
      }
      onSaved()
    } catch (e) {
      setServerError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-6 pb-8 sm:pb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">
          {prof ? 'Editar profissional' : 'Novo profissional'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          <Field label="Nome completo" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => touch('name')}
              className={inputClass('name')}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              disabled={!!prof}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              onBlur={() => touch('email')}
              className={`${inputClass('email')} disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500`}
            />
          </Field>

          <Field
            label={prof ? 'Nova senha (deixe em branco para não alterar)' : 'Senha inicial'}
            error={errors.password}
          >
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                onBlur={() => touch('password')}
                className={`${inputClass('password')} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {!prof && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                O profissional poderá alterar a senha no perfil após o primeiro acesso.
              </p>
            )}
          </Field>

          <Field label="WhatsApp">
            <input
              type="text"
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))}
              className={inputClass('phone')}
            />
          </Field>

          {prof && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">Profissional ativo</label>
            </div>
          )}

          {serverError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProfissionaisPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTarget, setFormTarget] = useState<Professional | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const data = await api.get<Professional[]>('/professionals')
      setProfessionals(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setFormTarget(null); setShowForm(true) }
  const openEdit = (p: Professional) => { setFormTarget(p); setShowForm(true) }
  const closeForm = () => setShowForm(false)
  const handleSaved = () => { closeForm(); load() }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Profissionais</h1>
        <button
          onClick={openCreate}
          title="Novo profissional"
          className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Novo profissional</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : professionals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum profissional cadastrado.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Cadastrar primeiro profissional
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Mobile: cards expansíveis */}
          <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {professionals.map((p) => (
              <div key={p.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{p.users.name}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedId === p.id && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50/50 space-y-3">
                    <dl className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Email</dt>
                        <dd className="text-gray-900 truncate ml-4 text-right">{p.users.email}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Status</dt>
                        <dd>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            p.users.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {p.users.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </dd>
                      </div>
                      {p.users.phone && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500">WhatsApp</dt>
                          <dd className="text-gray-900">{maskPhone(p.users.phone)}</dd>
                        </div>
                      )}
                    </dl>
                    <button
                      onClick={() => { openEdit(p); setExpandedId(null) }}
                      className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">WhatsApp</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {professionals.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.users.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.users.email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.users.phone ? maskPhone(p.users.phone) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        p.users.active
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {p.users.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <ProfessionalForm prof={formTarget} onClose={closeForm} onSaved={handleSaved} />
      )}
    </div>
  )
}
