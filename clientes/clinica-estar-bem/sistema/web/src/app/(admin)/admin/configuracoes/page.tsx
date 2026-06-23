'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

type Setting = { key: string; value: string; updated_at: string }
type WAStatus = { connected: boolean; qrDataUrl?: string }

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

  const [waStatus, setWaStatus] = useState<WAStatus | null>(null)
  const [waLoading, setWaLoading] = useState(true)
  const [pairMode, setPairMode] = useState<'qr' | 'code'>('qr')
  const [pairPhone, setPairPhone] = useState('')
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [pairLoading, setPairLoading] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)

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

  const loadWA = useCallback(async () => {
    setWaLoading(true)
    try {
      const data = await api.get<WAStatus>('/whatsapp/status')
      setWaStatus(data)
    } catch {
      setWaStatus(null)
    } finally {
      setWaLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadWA()
  }, [loadWA])

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

  const generatePairCode = async () => {
    setPairLoading(true)
    setPairCode(null)
    setPairError(null)
    try {
      const { code } = await api.post<{ code: string }>('/whatsapp/pair', { phone: pairPhone })
      setPairCode(code)
    } catch (e) {
      setPairError((e as Error).message)
    } finally {
      setPairLoading(false)
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
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-8">
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
                    className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving[s.key] ? 'Salvando...' : saved[s.key] ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* WhatsApp */}
      <h2 className="text-lg font-semibold text-gray-900 mb-1">WhatsApp</h2>
      <p className="text-sm text-gray-500 mb-4">Notificações automáticas para os profissionais</p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {waLoading ? (
          <p className="text-sm text-gray-500">Verificando status...</p>
        ) : waStatus === null ? (
          <p className="text-sm text-red-600">Não foi possível verificar o status do WhatsApp.</p>
        ) : waStatus.connected ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Conectado
            </span>
            <button onClick={loadWA} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Atualizar
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Desconectado
              </span>
              <button onClick={loadWA} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Atualizar
              </button>
            </div>

            {/* Toggle QR / Código */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-5">
              <button
                onClick={() => { setPairMode('qr'); setPairCode(null); setPairError(null) }}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${pairMode === 'qr' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                QR Code
              </button>
              <button
                onClick={() => { setPairMode('code'); setPairCode(null); setPairError(null) }}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${pairMode === 'code' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Código pelo celular
              </button>
            </div>

            {pairMode === 'qr' ? (
              waStatus.qrDataUrl ? (
                <div>
                  <p className="text-sm text-gray-700 mb-3">
                    Escaneie com o WhatsApp do número da clínica:
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={waStatus.qrDataUrl} alt="QR Code WhatsApp" className="w-48 h-48 border border-gray-200 rounded-xl" />
                  <p className="text-xs text-gray-400 mt-2">O QR expira em ~20 segundos. Clique em "Atualizar" se expirar.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aguarde o QR Code ser gerado e clique em "Atualizar".</p>
              )
            ) : (
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  Digite o número da clínica e gere um código para inserir no WhatsApp:
                </p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={pairPhone}
                    onChange={(e) => setPairPhone(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 w-44"
                  />
                  <button
                    onClick={generatePairCode}
                    disabled={pairLoading || !pairPhone}
                    className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    {pairLoading ? 'Gerando...' : 'Gerar código'}
                  </button>
                </div>

                {pairError && (
                  <p className="text-sm text-red-600 mb-3">{pairError}</p>
                )}

                {pairCode && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-2">Código de emparelhamento:</p>
                    <p className="text-3xl font-mono font-bold text-gray-900 tracking-widest mb-3">{pairCode}</p>
                    <p className="text-xs text-gray-500">
                      No WhatsApp do número da clínica:<br />
                      <strong>Menu → Dispositivos conectados → Conectar um dispositivo → Conectar com número de telefone</strong><br />
                      Digite o código acima.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
