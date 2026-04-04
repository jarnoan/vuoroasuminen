import Header from "@/components/layout/header"

export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">Schedule coming soon</h2>
          <p className="text-muted-foreground">
            The custody schedule will appear here in Phase 2.
          </p>
        </div>
      </main>
    </div>
  )
}
