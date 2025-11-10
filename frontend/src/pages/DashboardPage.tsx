export function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">
          Welcome to AI Studio MCP Control Plane. This is Phase 1 - Foundation setup.
        </p>
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Phase 1 Status</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
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
