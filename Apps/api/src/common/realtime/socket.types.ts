import type { JWTPayload } from '@your-app/contract';

// EXTENSION POINT (realtime): declare the events your server pushes to clients.
// Keep these in sync with the frontend's ServerToClientEvents (web/src/lib/realtime.ts).
export interface ServerToClientEvents {
  // 'resource:updated': (p: { id: string; timestamp: string }) => void;
  [event: string]: (...args: never[]) => void;
}

// EXTENSION POINT (realtime): declare the events clients may send to the server.
export interface ClientToServerEvents {
  subscribe: (resourceId: string) => void;
  unsubscribe: (resourceId: string) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  user?: JWTPayload;
}
