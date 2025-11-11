export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-fg mb-6">Dashboard</h1>
      <div className="bg-card border border-border rounded-lg shadow-md p-6">
        <p className="text-muted mb-6">
          Welcome to Vibe Studio MCP Control Plane. This is Phase 1 - Foundation setup.
        </p>
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-fg mb-4">Phase 1 Status</h2>
          <ul className="list-disc list-inside text-muted space-y-2">
            <li>✅ Monorepo structure</li>
            <li>✅ Docker Compose setup</li>
            <li>✅ Database schema (Prisma)</li>
            <li>✅ NestJS backend</li>
            <li>✅ React frontend</li>
            <li>⏳ Authentication (in progress)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
