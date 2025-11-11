import React from 'react';
import { useWebSocket } from '../services/websocket.service';
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
        isConnected
          ? 'bg-green-500/10 text-green-600 border border-green-500/20'
          : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
      )}
      data-testid="connection-status"
    >
      {isConnected ? (
        <>
          <WifiIcon className="h-4 w-4" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <ExclamationTriangleIcon className="h-4 w-4" />
          <span data-testid="connection-warning">Disconnected</span>
        </>
      )}
    </div>
  );
}
