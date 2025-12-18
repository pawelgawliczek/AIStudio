import { WifiIcon } from '@heroicons/react/24/outline';
import React from 'react';
import { useWebSocket } from '../services/websocket.service';

/**
 * ST-108: Connection status indicator
 * Only shows when WebSocket is connected (green indicator)
 * Hidden when not connected - avoids confusing "Disconnected" message
 * since WebSocket now requires JWT authentication
 */
export function ConnectionStatus() {
  const { isConnected } = useWebSocket();

  // Only show when connected - no need to show "Disconnected" status
  // WebSocket requires auth, so it won't connect until user is logged in
  if (!isConnected) {
    return null;
  }

  return (
    <div
      className="inline-flex items-center p-1.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20"
      data-testid="connection-status"
      title="WebSocket Connected"
    >
      <WifiIcon className="h-4 w-4" />
    </div>
  );
}
