'use client'

import { useState, useRef, useEffect } from 'react'

type DatePickerProps = {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  placeholder?: string
  min?: string // YYYY-MM-DD
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseDate(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function DatePicker({ value, onChange, placeholder = 'Selecionar data', min }: DatePickerProps) {
  const selected = parseDate(value)
  const minDate = parseDate(min ?? '')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<Date>(() => {
    const base = selected ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sincroniza cursor ao abrir se value mudou externamente
  useEffect(() => {
    if (selected) setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1))
  }, [value])

  const prevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
  const nextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))

  // Dias do grid: começa no domingo da semana do dia 1
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  const gridStart = new Date(firstDay)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const days: Date[] = []
  const d = new Date(gridStart)
  while (d <= lastDay || d.getDay() !== 0 || days.length < 35) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
    if (days.length >= 42) break
  }

  const pick = (day: Date) => {
    onChange(toIso(day))
    setOpen(false)
  }

  const fmtDisplay = (iso: string) => {
    const d = parseDate(iso)
    if (!d) return ''
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const isDisabled = (day: Date) => {
    if (minDate && day < minDate) return true
    return false
  }

  const isCurrentMonth = (day: Date) => day.getMonth() === cursor.getMonth()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400/30 ${
          open
            ? 'border-brand-400 bg-white'
            : 'border-gray-200 bg-white hover:border-brand-300'
        }`}
      >
        {/* Calendar icon */}
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange('') } }}
            className="ml-auto text-gray-300 hover:text-gray-500 text-base leading-none cursor-pointer"
            aria-label="Limpar data"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72 select-none">
          {/* Cabeçalho: mês e navegação */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-xs font-medium text-gray-400 py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((day, i) => {
              const iso = toIso(day)
              const isSelected = selected ? sameDay(day, selected) : false
              const isToday = sameDay(day, today)
              const disabled = isDisabled(day)
              const currentMonth = isCurrentMonth(day)

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && pick(day)}
                  className={`
                    relative h-8 w-full rounded-lg text-xs font-medium transition-colors
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${isSelected
                      ? 'bg-brand-600 text-white'
                      : disabled
                      ? 'text-gray-200'
                      : !currentMonth
                      ? 'text-gray-300 hover:bg-brand-50'
                      : 'text-gray-700 hover:bg-brand-50 hover:text-brand-700'
                    }
                  `}
                >
                  {isToday && !isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-400" />
                    </span>
                  )}
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {/* Botão "Hoje" */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => { onChange(toIso(today)); setOpen(false) }}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
