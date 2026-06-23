export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-7 bg-gray-100 rounded-lg w-40 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-11 bg-gray-50 border-b border-gray-200" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 border-t border-gray-100 px-4 flex items-center gap-8">
            <div className="h-3.5 bg-gray-100 rounded w-36" />
            <div className="h-3.5 bg-gray-100 rounded w-48" />
            <div className="h-3.5 bg-gray-100 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
