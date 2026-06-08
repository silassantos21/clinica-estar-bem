'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'

type RoomWithRate = {
  id: string
  name: string
  hourly_rate: number
  effective_rate: number
  active: boolean
}
type Slot = { hour: number; start_at: string; end_at: string; available: boolean }
type Patient = { id: string; name: string; phone: string | null }
type Me = { id: string; role: string; psychologistId?: string }

type Step = 'sala' | 'horario' | 'paciente' | 'confirmar'
const STEPS: Step[] = ['sala', 'horario', 'paciente', 'confirmar']
const STEP_LABEL: Record<Step, string> = {
  sala: 'Sala',
  horario: 'Horário',
  paciente: 'Paciente',
  confirmar: 'Confirmar',
}

export default function NovaReservaPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('sala')
  const [rooms, setRooms] = useState<RoomWithRate[]>([])
  const [selectedRoom, setSelectedRoom] = useState<RoomWithRate | null>(null)
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [generatingPayment, setGeneratingPayment] = useState(false)

  useEffect(() => {
    async function init() {
      const me = await api.get<Me>('/me')
      if (me.psychologistId) {
        const data = await api.get<RoomWithRate[]>(`/psychologists/${me.psychologistId}/rooms`)
        setRooms(data.filter((r) => r.active))
      } else {
        const data = await api.get<RoomWithRate[]>('/rooms')
        setRooms(
          data
            .filter((r: any) => r.active)
            .map((r: any) => ({ ...r, effective_rate: r.hourly_rate })),
        )
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedRoom || !date) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    api
      .get<Slot[]>(`/rooms/availability?room_id=${selectedRoom.id}&date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedRoom, date])

  useEffect(() => {
    if (step === 'paciente' && patients.length === 0) {
      api.get<Patient[]>('/patients').then(setPatients)
    }
  }, [step])

  const goNext = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }
  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleConfirm = async () => {
    if (!selectedRoom || !selectedSlot || !selectedPatient) return
    setSaving(true)
    setError(null)
    try {
      const reservation = await api.post<{ id: string }>('/reservations', {
        room_id: selectedRoom.id,
        patient_id: selectedPatient.id,
        start_at: selectedSlot.start_at,
      })
      setCreatedId(reservation.id)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const handlePayNow = async () => {
    if (!createdId) return
    setGeneratingPayment(true)
    try {
      const data = await api.post<{ payment_link_url: string }>(`/reservations/${createdId}/payment`, {})
      window.open(data.payment_link_url, '_blank')
      router.push('/psicologo/reservas')
    } catch (e) {
      alert((e as Error).message)
      setGeneratingPayment(false)
    }
  }

  const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtSlot = (s: Slot) =>
    `${String(s.hour).padStart(2, '0')}:00 – ${String(s.hour + 1).padStart(2, '0')}:00`

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const stepIdx = STEPS.indexOf(step)
  const todayStr = new Date().toISOString().split('T')[0]
  const currentHour = new Date().getHours()

  const isSlotDisabled = (slot: Slot) => {
    if (!slot.available) return true
    if (date === todayStr && slot.hour <= currentHour) return true
    return false
  }

  // Tela de sucesso após criação
  if (createdId) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Reserva criada!</h2>
          <p className="text-sm text-gray-500 mb-6">
            A reserva está pendente de pagamento. Gere o link do Mercado Pago para confirmar.
          </p>
          <div className="space-y-3">
            <button
              onClick={handlePayNow}
              disabled={generatingPayment}
              className="w-full px-5 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {generatingPayment ? 'Gerando link...' : 'Pagar agora'}
            </button>
            <button
              onClick={() => router.push('/psicologo/reservas')}
              className="w-full px-5 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Pagar depois
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Nova reserva</h1>
      </div>

      {/* Barra de progresso */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                i < stepIdx
                  ? 'bg-brand-600 text-white'
                  : i === stepIdx
                  ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < stepIdx ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                i === stepIdx
                  ? 'text-brand-700'
                  : i < stepIdx
                  ? 'text-brand-500'
                  : 'text-gray-300'
              }`}
            >
              {STEP_LABEL[s]}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 h-px w-8 ${i < stepIdx ? 'bg-brand-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">

        {/* ── Etapa 1: Sala + Data ── */}
        {step === 'sala' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Sala e data</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  min={todayStr}
                  placeholder="Selecionar data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sala</label>
                {rooms.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma sala ativa cadastrada.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                          selectedRoom?.id === room.id
                            ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
                            : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{room.name}</span>
                          <span className="text-gray-700 font-medium">{brl(room.effective_rate)}/h</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedRoom || !date}
                className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Etapa 2: Horário ── */}
        {step === 'horario' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Horário disponível</h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedRoom?.name} · {fmtDate(date)}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-gray-500">Carregando disponibilidade...</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const disabled = isSlotDisabled(slot)
                  const selected = selectedSlot?.hour === slot.hour
                  return (
                    <button
                      key={slot.hour}
                      type="button"
                      onClick={() => !disabled && setSelectedSlot(slot)}
                      disabled={disabled}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        disabled
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                          : selected
                          ? 'bg-brand-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-brand-400 hover:bg-brand-50'
                      }`}
                    >
                      {fmtSlot(slot)}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">
              <span className="inline-block w-3 h-3 bg-gray-100 rounded mr-1 align-middle" />
              Horário ocupado ou passado
            </p>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={goBack} className="px-5 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedSlot}
                className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Etapa 3: Paciente ── */}
        {step === 'paciente' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Paciente</h2>
            {patients.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 mb-3">Nenhum paciente cadastrado.</p>
                <a href="/psicologo/pacientes" className="text-sm font-medium text-brand-600 underline">
                  Cadastrar paciente
                </a>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                      selectedPatient?.id === p.id
                        ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400'
                        : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{p.name}</div>
                    {p.phone && <div className="text-gray-400 text-xs mt-0.5">{p.phone}</div>}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={goBack} className="px-5 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedPatient}
                className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* ── Etapa 4: Confirmar ── */}
        {step === 'confirmar' && selectedRoom && selectedSlot && selectedPatient && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Confirmar reserva</h2>
            <dl className="space-y-0 text-sm divide-y divide-gray-100">
              <div className="flex justify-between py-3">
                <dt className="text-gray-500">Sala</dt>
                <dd className="text-gray-900 font-medium">{selectedRoom.name}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-500">Data</dt>
                <dd className="text-gray-900">{fmtDate(date)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-500">Horário</dt>
                <dd className="text-gray-900">{fmtSlot(selectedSlot)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-500">Paciente</dt>
                <dd className="text-gray-900">{selectedPatient.name}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-900 font-semibold">Valor (sua tarifa)</dt>
                <dd className="text-brand-600 font-semibold">{brl(selectedRoom.effective_rate)}</dd>
              </div>
            </dl>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            <div className="mt-6 flex justify-between">
              <button type="button" onClick={goBack} className="px-5 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Criando...' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
