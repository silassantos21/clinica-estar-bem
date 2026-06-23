'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type ReportRow = {
  professional_id: string
  name: string
  reservations_count: number
  cancellations_count: number
  rooms_used: string[]
}

type Report = { start: string; end: string; rows: ReportRow[] }

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const addDays = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function RelatoriosPage() {
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly')
  const [weekStart, setWeekStart] = useState(getWeekStart)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setReport(null)
    setError(null)
    setLoading(true)
    const url = mode === 'weekly'
      ? `/reports/weekly?start=${weekStart}`
      : `/reports/monthly?month=${month}&year=${year}`
    api.get<Report>(url)
      .then(setReport)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [mode, weekStart, month, year])

  const totals = report ? {
    reservations: report.rows.reduce((a, r) => a + r.reservations_count, 0),
    cancellations: report.rows.reduce((a, r) => a + r.cancellations_count, 0),
  } : null

  const periodLabel = report
    ? mode === 'weekly'
      ? `${fmtDate(report.start)} a ${fmtDate(addDays(report.start, 6))}`
      : `${MONTHS[month - 1]} ${year}`
    : ''

  const handleDownloadPDF = async () => {
    if (!report) return
    setDownloading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = ((await import('html2pdf.js')) as any).default

      const logoSvgRaw = await fetch('/logo-icon.svg').then((r) => r.text())
      const logoPng = await new Promise<string>((resolve) => {
        const blob = new Blob([logoSvgRaw], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 176
          canvas.height = 176
          canvas.getContext('2d')!.drawImage(img, 0, 0, 176, 176)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => { URL.revokeObjectURL(url); resolve('') }
        img.src = url
      })

      const periodStr = mode === 'weekly'
        ? `${fmtDate(report.start)} a ${fmtDate(addDays(report.start, 6))}`
        : `${MONTHS[month - 1]} ${year}`
      const reportType = mode === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal'
      const footerTotals = totals ?? { reservations: 0, cancellations: 0 }

      const rows = report.rows.map((row) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-weight:500;color:#111827">${row.name}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151">${row.reservations_count}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151">${row.cancellations_count}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${row.rooms_used.join(', ') || '—'}</td>
        </tr>
      `).join('')

      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;color:#111827">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid #C01C63;margin-bottom:24px">
            ${logoPng ? `<img src="${logoPng}" width="88" height="88" style="display:block;flex-shrink:0" />` : ''}
            <div style="text-align:right">
              <p style="font-size:18px;font-weight:700;color:#C01C63;margin:0">Núcleo Estar Bem</p>
              <p style="font-size:14px;font-weight:600;color:#374151;margin:6px 0 0">${reportType}</p>
              <p style="font-size:13px;color:#6b7280;margin:4px 0 0">${periodStr}</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb">
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#6b7280">Profissional</th>
                <th style="padding:10px 16px;text-align:center;font-weight:600;color:#6b7280">Agendamentos</th>
                <th style="padding:10px 16px;text-align:center;font-weight:600;color:#6b7280">Cancelamentos</th>
                <th style="padding:10px 16px;text-align:left;font-weight:600;color:#6b7280">Salas utilizadas</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="border-top:2px solid #e5e7eb;background:#f9fafb">
                <td style="padding:10px 16px;font-weight:700;color:#374151">Total</td>
                <td style="padding:10px 16px;text-align:center;font-weight:700;color:#374151">${footerTotals.reservations}</td>
                <td style="padding:10px 16px;text-align:center;font-weight:700;color:#374151">${footerTotals.cancellations}</td>
                <td style="padding:10px 16px"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `

      const filename = `relatorio-${mode === 'weekly' ? 'semanal' : 'mensal'}-${periodStr.replace(/\//g, '-').replace(/ /g, '_')}.pdf`

      await html2pdf().set({
        margin: [1.5, 2, 1.5, 2],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' },
      }).from(html).save()
    } catch (e) {
      alert('Erro ao gerar PDF: ' + (e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  const prevWeek = () => setWeekStart(addDays(weekStart, -7))
  const nextWeek = () => setWeekStart(addDays(weekStart, 7))
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1) }

  return (
    <div>
      {/* Cabeçalho de impressão */}
      <div className="hidden print:block mb-6">
        <div
          className="flex items-center justify-between pb-4 mb-4"
          style={{ borderBottom: '3px solid #C01C63' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="Núcleo Estar Bem" className="h-24 w-auto" />
          <div className="text-right">
            <p className="text-lg font-bold" style={{ color: '#C01C63' }}>Núcleo Estar Bem</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {mode === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal'}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
          </div>
        </div>
      </div>

      {/* Cabeçalho de tela */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Relatórios</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading || !report || report.rows.length === 0}
            title={downloading ? 'Gerando...' : 'Baixar PDF'}
            className="p-2 min-h-[44px] min-w-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline text-sm">{downloading ? 'Gerando...' : 'Baixar PDF'}</span>
          </button>
          <button
            onClick={() => window.print()}
            title="Imprimir"
            className="p-2 min-h-[44px] min-w-[44px] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline text-sm">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="print:hidden mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-brand-300 overflow-hidden text-sm">
          <button
            onClick={() => setMode('weekly')}
            className={`px-4 py-2 transition-colors ${mode === 'weekly' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-brand-50'}`}
          >
            Semanal
          </button>
          <button
            onClick={() => setMode('monthly')}
            className={`px-4 py-2 transition-colors border-l border-brand-300 ${mode === 'monthly' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-brand-50'}`}
          >
            Mensal
          </button>
        </div>

        {mode === 'weekly' ? (
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ChevronLeft />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300 w-48 text-center">
              {fmtDate(weekStart)} a {fmtDate(addDays(weekStart, 6))}
            </span>
            <button onClick={nextWeek} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ChevronRight />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ChevronLeft />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300 w-36 text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <ChevronRight />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 print:hidden">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : report && report.rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum dado para este período.</p>
        </div>
      ) : report ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Mobile: cards expansíveis */}
          <div className="sm:hidden divide-y divide-gray-100 print:hidden">
            {report.rows.map((row) => (
              <div key={row.professional_id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === row.professional_id ? null : row.professional_id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{row.name}</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedId === row.professional_id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedId === row.professional_id && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50/50 space-y-2">
                    <dl className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Agendamentos</dt>
                        <dd className="text-gray-900 font-medium tabular-nums">{row.reservations_count}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Cancelamentos</dt>
                        <dd className="text-gray-900 font-medium tabular-nums">{row.cancellations_count}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 shrink-0">Salas</dt>
                        <dd className="text-gray-600 text-xs text-right">{row.rooms_used.length > 0 ? row.rooms_used.join(', ') : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            ))}

            {totals && (
              <div className="px-4 py-3.5 bg-gray-50 border-t border-gray-100 space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Total de Agendamentos:</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{totals.reservations}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-500">Total de Cancelamentos:</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{totals.cancellations}</span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Profissional</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Agendamentos</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Cancelamentos</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Salas utilizadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.rows.map((row) => (
                  <tr key={row.professional_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 tabular-nums">{row.reservations_count}</td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 tabular-nums">{row.cancellations_count}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {row.rooms_used.length > 0 ? row.rooms_used.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Total</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{totals.reservations}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{totals.cancellations}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
