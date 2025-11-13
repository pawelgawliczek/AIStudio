interface EmptyStateProps {
  title: string;
  message: string;
  icon?: string;
}

export function EmptyState({ title, message, icon = '📊' }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-lg shadow p-12">
      <div className="text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-blue-800">
            <strong>Getting Started:</strong> Run workflows through the system to start collecting
            performance metrics. Once workflows complete, their metrics will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
