import { io, type Socket } from "socket.io-client";
import { UserType } from "@dragon-telecom/contract";
import * as tokenStore from "./token-store";
import { refreshTokens } from "./axios";
import { queryClient } from "./query-client";

// Realtime is OPT-IN. Every entry point below no-ops unless VITE_WS_ENABLED === "true",
// so AuthProvider can wire the role socket unconditionally and it stays dormant when off.
// To remove realtime entirely, delete this file + its imports and the backend realtime/.
const WS_ENABLED = import.meta.env.VITE_WS_ENABLED === "true";

// Namespaces + the client→server interface, kept in sync with the backend
// (api/src/common/realtime/socket.types.ts + rooms.ts).
const NS = {
  USERS: "/users",
  ADMIN: "/admin",
} as const;

// EXTENSION POINT (realtime): declare the events your server pushes here.
interface ServerToClientEvents {
  [event: string]: (...args: never[]) => void;
}
interface ClientToServerEvents {
  subscribe: (resourceId: string) => void;
  unsubscribe: (resourceId: string) => void;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function wsUrl(namespace: string): string {
  return import.meta.env.VITE_WS_URL + namespace;
}

// ─── Connection status store (backs useRealtimeStatus) ───────────────────────
// Sockets are a freshness signal, never a data source — this store is purely UI-facing
// connection health, never written with domain data.
export type RealtimeStatus = "disconnected" | "connecting" | "connected";

type StatusListener = () => void;
const statusListeners = new Set<StatusListener>();
let status: RealtimeStatus = "disconnected";

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

export function onRealtimeStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function attachStatusTracking(socket: AppSocket): void {
  socket.on("connect", () => setStatus("connected"));
  socket.on("disconnect", () => setStatus("disconnected"));
  socket.io.on("reconnect_attempt", () => setStatus("connecting"));
}

// ─── Auth handshake + reconnect-on-refresh (authed namespaces) ───────────────
// Callback form re-evaluates on every (re)connection attempt, so a token refreshed after
// the socket was created is still picked up on the next handshake.
function authCallback(cb: (data: { token: string | null }) => void): void {
  cb({ token: tokenStore.getAccessToken() });
}

// Shares the one single-flight refreshTokens() (src/lib/axios.ts) so a REST 401 and a socket
// UNAUTHORIZED handshake happening together never trigger two separate refreshes.
function attachAuthErrorHandling(socket: AppSocket): void {
  let hasRetried = false;
  socket.on("connect", () => {
    hasRetried = false;
  });
  socket.on("connect_error", (err) => {
    if (err.message === "UNAUTHORIZED") {
      if (hasRetried) {
        socket.disconnect();
        return;
      }
      hasRetried = true;
      refreshTokens()
        .then(() => socket.connect())
        .catch(() => socket.disconnect()); // refresh failed — axios interceptor owns the logout redirect
    } else if (err.message === "FORBIDDEN") {
      socket.disconnect(); // wrong role for this namespace — permanent, no retry
    }
    // Any other connect_error is left to Socket.IO's own reconnection/backoff.
  });
}

// EXTENSION POINT (realtime): invalidate the affected queries when a server event lands.
// Every handler invalidates only — payloads are never written into the cache. REST stays
// the single source of truth. Example:
//   socket.on("resource:updated", () =>
//     queryClient.invalidateQueries({ queryKey: qk.someDomain.all() }),
//   );
function attachDomainListeners(_socket: AppSocket): void {
  void queryClient;
}

// ─── Role socket (authed — /users or /admin) ─────────────────────────────────
let roleSocket: AppSocket | null = null;

export function connectRoleSocket(type: UserType): void {
  if (!WS_ENABLED) return;
  disconnectRoleSocket();
  const namespace = type === UserType.ADMIN ? NS.ADMIN : NS.USERS;
  const socket = io(wsUrl(namespace), { auth: authCallback }) as AppSocket;

  attachAuthErrorHandling(socket);
  attachStatusTracking(socket);
  attachDomainListeners(socket);

  roleSocket = socket;
}

export function disconnectRoleSocket(): void {
  if (!roleSocket) return;
  roleSocket.disconnect();
  roleSocket.removeAllListeners();
  roleSocket = null;
}
