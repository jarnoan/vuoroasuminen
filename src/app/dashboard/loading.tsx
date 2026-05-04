export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header placeholder — matches h-14 border-b of real header */}
      <div className="h-14 border-b" />
      {/* ViewToolbar placeholder — matches h-10 border-b of toolbar */}
      <div className="h-10 border-b" />
      {/* Publish bar placeholder — matches px-4 py-2 border-b row */}
      <div className="h-10 border-b" />
      {/* Schedule table skeleton */}
      <div className="flex-1 p-4 animate-pulse space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}
