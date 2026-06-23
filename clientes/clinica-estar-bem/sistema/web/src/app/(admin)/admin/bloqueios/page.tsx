'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { DatePicker } from '@/components/DatePicker'
import { Select } from '@/components/Select'

type Room = { id: string; name: string; number: number; active: boolean }
type Slot = { hour: number; available: boolean; blocked: boolean }
type Block = { id: string; room_id: string; date: string; hour: number; reason: string | null }

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

const initHour = () => {
  const h = new Date().getHours()
  return Math.min(Math.max(h, 7), 21)
}

export default function BloqueiosPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [date, setDate] = useState(localToday)
  const [availability, setAvailability] = useState<Record<string, Slot[]>>({})
  const [blocks, setBlocks] = useState<Record<string, Block[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Selects mobile
  const [selectedHour, setSelectedHour] = useState<number>(initHour)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')

  const [blockModal, setBlockModal] = useState<{ room: Room; hour: number } | null>(null)
  const [unblockModal, setUnblockModal] = useState<{ block: Block; room: Room } | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<Room[]>('/rooms')
      .then((data) => {
        const active = data.filter((r) => r.active)
        setRooms(active)
        if (active.length > 0) setSelectedRoomId(active[0].id)
      })
      .catch(() => setRooms([]))
  }, [])

  useEffect(() => {
    if (!rooms.length) return
    let cancelled = false
    setLoading(true)

    Promise.all([
      Promise.all(rooms.map((r) =>
        api.get<Slot[]>(`/rooms/availability?room_id=${r.id}&date=${date}`).catch(() => [] as Slot[])
      )),
      Promise.all(rooms.map((r) =>
        api.get<Block[]>(`/rooms/${r.id}/blocks?date=${date}`).catch(() => [] as Block[])
      )),
    ]).then(([availResults, blockResults]) => {
      if (cancelled) return
      const avail: Record<string, Slot[]> = {}
      const blks: Record<string, Block[]> = {}
      rooms.forEach((r, i) => {
        avail[r.id] = availResults[i]
        blks[r.id] = blockResults[i]
      })
      setAvailability(avail)
      setBlocks(blks)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [rooms, date, refreshKey])

  const getSlot = (roomId: string, hour: number) =>
    availability[roomId]?.find((s) => s.hour === hour)

  const getBlock = (roomId: string, hour: number) =>
    blocks[roomId]?.find((b) => b.hour === hour)

  const todayStr = localToday()
  const currentHour = new Date().getHours()
  const isPast = (hour: number) => date === todayStr && hour <= currentHour

  const handleCellClick = (room: Room, hour: number) => {
    if (isPast(hour)) return
    const slot = getSlot(room.id, hour)
    if (!slot) return
    if (slot.blocked) {
      const block = getBlock(room.id, hour)
      if (block) setUnblockModal({ block, room })
    } else if (slot.available) {
      setReason('')
      setBlockModal({ room, hour })
    }
  }

  const handleBlock = async () => {
    if (!blockModal) return
    setSaving(true)
    try {
      await api.post(`/rooms/${blockModal.room.id}/blocks`, {
        date,
        hour: blockModal.hour,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      setBlockModal(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleUnblock = async () => {
    if (!unblockModal) return
    setSaving(true)
    try {
      await api.delete(`/rooms/${unblockModal.block.room_id}/blocks/${unblockModal.block.id}`)
      setUnblockModal(null)
      setRefreshKey((k) => k + 1)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Dados derivados do painel mobile
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const selectedSlot = selectedRoomId ? getSlot(selectedRoomId, selectedHour) : undefined
  const selectedBlock = selectedRoomId ? getBlock(selectedRoomId, selectedHour) : undefined
  const isMobilePast = isPast(selectedHour)

  type StatusType = 'free' | 'blocked' | 'occupied' | 'past' | 'loading'
  const mobileStatus: StatusType =
    loading ? 'loading' :
    isMobilePast ? 'past' :
    selectedSlot?.blocked ? 'blocked' :
    selectedSlot && !selectedSlot.available ? 'occupied' :
    selectedSlot?.available ? 'free' :
    'loading'

  const handleMobileAction = () => {
    if (!selectedRoom || !selectedSlot || isMobilePast) return
    if (selectedSlot.blocked && selectedBlock) {
      setUnblockModal({ block: selectedBlock, room: selectedRoom })
    } else if (selectedSlot.available) {
      setReason('')
      setBlockModal({ room: selectedRoom, hour: selectedHour })
    }
  }

  const hourOptions = HOURS.map((h) => ({ value: String(h), label: `${fmtHour(h)} – ${fmtHour(h + 1)}` }))
  const roomOptions = rooms.map((r) => ({ value: r.id, label: r.name }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Bloqueios</h1>
      </div>

      {/* Seletor de data — compartilhado mobile e desktop */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="w-44">
          <DatePicker value={date} onChange={setDate} />
        </div>
        {/* Legenda apenas no desktop */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded border border-gray-200 bg-white" />
            Livre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-200" />
            Bloqueado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-gray-100" />
            Ocupado
          </span>
        </div>
      </div>

      {loading && !Object.keys(availability).length ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma sala ativa.</p>
      ) : (
        <>
          {/* ─── MOBILE ─── */}
          <div className="sm:hidden space-y-4">

            {/* Selects: hora e sala lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Hora</p>
                <Select
                  value={String(selectedHour)}
                  onChange={(v) => setSelectedHour(Number(v))}
                  options={hourOptions}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sala</p>
                <Select
                  value={selectedRoomId}
                  onChange={setSelectedRoomId}
                  options={roomOptions}
                />
              </div>
            </div>

            {/* Painel de status */}
            {selectedRoom && (
              <div className={`rounded-2xl p-5 border-2 transition-all ${
                mobileStatus === 'free'     ? 'bg-white border-gray-200' :
                mobileStatus === 'blocked'  ? 'bg-orange-50 border-orange-300' :
                mobileStatus === 'occupied' ? 'bg-gray-50 border-gray-200' :
                                              'bg-gray-50 border-gray-200'
              }`}>

                {/* Cabeçalho do painel */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{selectedRoom.name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {fmtDate(date)} · {fmtHour(selectedHour)}–{fmtHour(selectedHour + 1)}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    mobileStatus === 'free'     ? 'bg-green-100 text-green-700' :
                    mobileStatus === 'blocked'  ? 'bg-orange-100 text-orange-700' :
                    mobileStatus === 'occupied' ? 'bg-blue-100 text-blue-700' :
                    mobileStatus === 'past'     ? 'bg-gray-100 text-gray-400' :
                                                  'bg-gray-100 text-gray-400'
                  }`}>
                    {mobileStatus === 'free'     ? 'Disponível' :
                     mobileStatus === 'blocked'  ? 'Bloqueado' :
                     mobileStatus === 'occupied' ? 'Reservado' :
                     mobileStatus === 'past'     ? 'Passado' : '—'}
                  </span>
                </div>

                {/* Corpo por status */}
                {mobileStatus === 'free' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Horário disponível para reservas.
                    </p>
                    <button
                      onClick={handleMobileAction}
                      className="w-full py-3.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all min-h-[52px]"
                    >
                      Bloquear este horário
                    </button>
                  </div>
                )}

                {mobileStatus === 'blocked' && (
                  <div className="space-y-3">
                    {selectedBlock?.reason ? (
                      <div className="bg-orange-100 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Motivo</p>
                        <p className="text-sm text-orange-900 font-medium">{selectedBlock.reason}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-orange-600">Bloqueado sem motivo definido.</p>
                    )}
                    <button
                      onClick={handleMobileAction}
                      className="w-full py-3.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all min-h-[52px]"
                    >
                      Desbloquear este horário
                    </button>
                  </div>
                )}

                {mobileStatus === 'occupied' && (
                  <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                    <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-blue-700">Horário com reserva ativa — não pode ser bloqueado.</p>
                  </div>
                )}

                {mobileStatus === 'past' && (
                  <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3">
                    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">Este horário já passou.</p>
                  </div>
                )}

                {mobileStatus === 'loading' && (
                  <p className="text-sm text-gray-400">Carregando status...</p>
                )}
              </div>
            )}
          </div>

          {/* ─── DESKTOP ─── */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="text-sm min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Hora</th>
                  {rooms.map((room) => (
                    <th key={room.id} className="px-3 py-3 text-center font-medium text-gray-500">
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {HOURS.map((hour) => (
                  <tr key={hour} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-400 tabular-nums text-xs font-mono">
                      {fmtHour(hour)}
                    </td>
                    {rooms.map((room) => {
                      const slot = getSlot(room.id, hour)
                      const block = getBlock(room.id, hour)
                      const isBlocked = slot?.blocked ?? false
                      const isOccupied = slot ? (!slot.available && !slot.blocked) : false
                      const isFree = slot?.available ?? false
                      const past = isPast(hour)
                      const disabled = isOccupied || !slot || past

                      let cellClass = 'w-full px-2 py-1.5 rounded text-xs font-medium transition-colors '
                      let label = ''
                      let title = ''

                      if (past && isBlocked) {
                        cellClass += 'bg-orange-50/50 text-orange-300 border border-orange-100 cursor-default'
                        label = 'Bloqueado'
                        title = block?.reason ? `Bloqueado: ${block.reason}` : 'Bloqueado'
                      } else if (past) {
                        cellClass += 'bg-gray-50 text-gray-300 cursor-default'
                        label = 'Passado'
                        title = 'Horário já passou'
                      } else if (isBlocked) {
                        cellClass += 'bg-orange-50 text-orange-500 border border-orange-200 hover:bg-orange-100 cursor-pointer'
                        label = 'Bloqueado'
                        title = block?.reason
                          ? `Bloqueado: ${block.reason} — clique para desbloquear`
                          : 'Bloqueado — clique para desbloquear'
                      } else if (isOccupied) {
                        cellClass += 'bg-gray-100 text-gray-400 cursor-default'
                        label = 'Ocupado'
                        title = 'Horário reservado'
                      } else if (isFree) {
                        cellClass += 'bg-white border border-gray-200 text-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-400 cursor-pointer'
                        label = 'Livre'
                        title = 'Clique para bloquear'
                      } else {
                        cellClass += 'bg-gray-50 text-gray-300 cursor-default'
                        label = '—'
                      }

                      return (
                        <td key={room.id} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => handleCellClick(room, hour)}
                            disabled={disabled}
                            title={title}
                            className={cellClass}
                          >
                            {label}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal: Bloquear horário */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6 pb-8 sm:pb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Bloquear horário</h2>
            <p className="text-sm text-gray-500 mb-4">
              {blockModal.room.name} · {fmtDate(date)} · {fmtHour(blockModal.hour)}–{fmtHour(blockModal.hour + 1)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
                  placeholder="Ex: manutenção, reunião..."
                  autoFocus
                  className="w-full border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30 placeholder:text-gray-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBlockModal(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {saving ? 'Bloqueando...' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Desbloquear horário */}
      {unblockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6 pb-8 sm:pb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Desbloquear horário</h2>
            <p className="text-sm text-gray-500 mb-4">
              {unblockModal.room.name} · {fmtDate(date)} · {fmtHour(unblockModal.block.hour)}–{fmtHour(unblockModal.block.hour + 1)}
            </p>
            {unblockModal.block.reason && (
              <div className="mb-4 bg-orange-50 px-3 py-2.5 rounded-lg border border-orange-100">
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-0.5">Motivo do bloqueio</p>
                <p className="text-sm text-orange-800 font-medium">{unblockModal.block.reason}</p>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-5">Deseja liberar este horário para reservas?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUnblockModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUnblock}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Desbloqueando...' : 'Desbloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
