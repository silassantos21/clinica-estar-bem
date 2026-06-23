'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'

type Room = { id: string; name: string; number: number; active: boolean }
type Slot = { hour: number; start_at: string; end_at: string; available: boolean; blocked: boolean }

type Step = 'sala' | 'horario' | 'confirmar'
const STEPS: Step[] = ['sala', 'horario', 'confirmar']
const STEP_LABEL: Record<Step, string> = {
  sala: 'Sala',
  horario: 'Horário',
  confirmar: 'Confirmar',
}

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NovaReservaPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('sala')
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [date, setDate] = useState<string>(localToday)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.get<Room[]>('/rooms')
      .then((data) => setRooms(data.filter((r) => r.active)))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false))
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

  const goNext = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }
  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleConfirm = async () => {
    if (!selectedRoom || !selectedSlot) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/reservations', {
        room_id: selectedRoom.id,
        start_at: selectedSlot.start_at,
      })
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const fmtSlot = (s: Slot) =>
    `${String(s.hour).padStart(2, '0')}:00 – ${String(s.hour + 1).padStart(2, '0')}:00`

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const stepIdx = STEPS.indexOf(step)
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentHour = now.getHours()

  const isSlotDisabled = (slot: Slot) => {
    if (!slot.available) return true
    if (date === todayStr && slot.hour <= currentHour) return true
    return false
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Reserva confirmada!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {selectedRoom?.name} · {fmtDate(date)} · {selectedSlot && fmtSlot(selectedSlot)}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setDone(false); setStep('sala'); setSelectedRoom(null); setSelectedSlot(null) }}
              className="w-full px-5 py-2.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
            >
              Nova reserva
            </button>
            <button
              onClick={() => router.push('/psicologo/reservas')}
              className="w-full px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Ver minhas reservas
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Nova reserva</h1>
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
                  ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/40'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
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
            <span className={`ml-2 text-sm font-medium ${
              i === stepIdx ? 'text-brand-700 dark:text-brand-400' : i < stepIdx ? 'text-brand-500 dark:text-brand-500' : 'text-gray-300 dark:text-gray-600'
            }`}>
              {STEP_LABEL[s]}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 h-px w-8 ${i < stepIdx ? 'bg-brand-300' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">

        {/* Etapa 1: Sala + Data */}
        {step === 'sala' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Sala e data</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data</label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  min={todayStr}
                  placeholder="Selecionar data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sala</label>
                {loadingRooms ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : rooms.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma sala disponível no momento.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                          selectedRoom?.id === room.id
                            ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-400'
                            : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{room.name}</span>
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
                className="px-5 py-2.5 min-h-[44px] bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Etapa 2: Horário */}
        {step === 'horario' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Horário disponível</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {selectedRoom?.name} · {fmtDate(date)}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Carregando disponibilidade...</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                          ? slot.blocked
                            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-300 dark:text-orange-600 cursor-not-allowed'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed line-through'
                          : selected
                          ? 'bg-brand-600 text-white'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                      }`}
                    >
                      {fmtSlot(slot)}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                Ocupado / passado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-orange-50 dark:bg-orange-900/20 rounded" />
                Bloqueado
              </span>
            </div>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={goBack}
                className="px-5 py-2.5 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedSlot}
                className="px-5 py-2.5 min-h-[44px] bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Etapa 3: Confirmar */}
        {step === 'confirmar' && selectedRoom && selectedSlot && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirmar reserva</h2>
            <dl className="space-y-0 text-sm divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between py-3">
                <dt className="text-gray-500 dark:text-gray-400">Sala</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-medium">{selectedRoom.name}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-500 dark:text-gray-400">Data</dt>
                <dd className="text-gray-900 dark:text-gray-100">{fmtDate(date)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-500 dark:text-gray-400">Horário</dt>
                <dd className="text-gray-900 dark:text-gray-100">{fmtSlot(selectedSlot)}</dd>
              </div>
            </dl>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <div className="mt-6 flex justify-between">
              <button type="button" onClick={goBack}
                className="px-5 py-2.5 min-h-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="px-5 py-2.5 min-h-[44px] bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Confirmando...' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
