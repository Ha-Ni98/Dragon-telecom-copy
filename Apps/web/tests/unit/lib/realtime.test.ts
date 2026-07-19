import { describe, it, expect } from "vitest";
import {
  getRealtimeStatus,
  onRealtimeStatusChange,
  connectRoleSocket,
} from "@/lib/realtime";
import { UserRole } from "@dragon-telecom/contract";

// Realtime is opt-in and off by default (VITE_WS_ENABLED unset in tests), so connectRoleSocket
// is a no-op and no socket is ever opened. These tests cover the always-present status store
// and the gated entry point. When you turn realtime on, expand this to assert socket wiring.
describe("realtime status store", () => {
  it("starts disconnected", () => {
    expect(getRealtimeStatus()).toBe("disconnected");
  });

  it("subscribes and unsubscribes listeners without throwing", () => {
    const off = onRealtimeStatusChange(() => {});
    expect(() => off()).not.toThrow();
  });
});

describe("connectRoleSocket (disabled)", () => {
  it("is a no-op when VITE_WS_ENABLED is not 'true' and leaves status disconnected", () => {
    connectRoleSocket(UserRole.ADMIN);
    expect(getRealtimeStatus()).toBe("disconnected");
  });
});
