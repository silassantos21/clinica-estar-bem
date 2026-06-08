'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Setting = { key: string; value: string; updated_at: string }

const labels: Record<string, { label: string; hint: string; type: string }> = {
  cancellation_tolerance_hours: {
    label: 'Tolerância de cancelamento (horas)',
    hint: 'Cancelamentos feitos com menos horas de antecedência ficam sujeitos à penalidade.',
    type: 'number',
  },
}

export default function ConfiguracoesPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const data = await api.get<Setting[]>('/settings')
      setSettings(data)
      setValues(Object.fromEntries(data.map((s) => [s.key, s.value])))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async (key: string) => {
    setSaving((s) => ({ ...s, [key]: true }))
    try {
      await api.put(`/settings/${key}`, { value: values[key] })
      setSaved((s) => ({ ...s, [key]: true }))
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving((s) => ({ ...s, [key]: false }))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Configurações</h1>
      <p className="text-sm text-gray-500 mb-8">Parâmetros do sistema</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {settings.map((s) => {
            const meta = labels[s.key] ?? { label: s.key, hint: '', type: 'text' }
            return (
              <div key={s.key} className="p-6">
                <label className="block text-sm font-medium text-gray-900 mb-0.5">{meta.label}</label>
                {meta.hint && <p className="text-xs text-gray-500 mb-3">{meta.hint}</p>}
                <div className="flex items-center gap-3">
                  <input
                    type={meta.type}
                    min={meta.type === 'number' ? '0' : undefined}
                    step={meta.type === 'number' ? '1' : undefined}
                    value={values[s.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                    className="w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                  <button
                    onClick={() => save(s.key)}
                    disabled={saving[s.key]}
                    className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    {saving[s.key] ? 'Salvando...' : saved[s.key] ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
