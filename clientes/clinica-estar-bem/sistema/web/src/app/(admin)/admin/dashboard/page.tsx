export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Visão geral</h1>
      <p className="text-sm text-gray-500 mb-8">Resumo do dia</p>

      {/* Cards de métricas — preenchidos no Sprint 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Reservas hoje', 'Receita do mês', 'Repasses pendentes', 'Taxa de ocupação'].map((label) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-2">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
