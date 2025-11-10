import React from 'react';
import { useWebSocket } from '../services/websocket.service';
import { WifiIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  return (
    <div
      className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium"
      data-testid="connection-status"
    >
      {isConnected ? (
        <>
          <WifiIcon className="h-4 w-4 text-green-500" />
          <span className="text-green-700">Connected</span>
        </>
      ) : (
        <>
          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
          <span className="text-yellow-700" data-testid="connection-warning">
            Disconnected
          </span>
        </>
      )}
    </div>
  );
}
