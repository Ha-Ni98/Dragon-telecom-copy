import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { UserType as PrismaUserType } from '@prisma/client';
import { hashPassword } from './password.utils';

const SYSTEM_USERNAME = 'system.internal';

// Bootstraps (and caches) a placeholder "system" Staff row for any stock/history mutation with
// no natural staff actor — a guest/client storefront order placement, or any ADMIN-initiated
// mutation (an ADMIN JWT never carries a staffId: Staff rows exist only for UserType.STAFF,
// confirmed via identity.service.ts, which only sets it `if (user.staff)`). Both
// StockMovement.staffId and RepairStatusHistory.staffId are NOT NULL FKs to Staff, so a real
// row must exist — no schema/seed change; a self-bootstrapping row is created once (race-safe
// under concurrency via User.username's @unique constraint and `upsert`) and reused thereafter.
// Originally introduced in the orders module (Sprint 2); extracted here once repairs needed the
// identical fallback for its own createRepair/addPart/removePart/changeStatus mutations, rather
// than duplicating this same bootstrap logic in a second service.
//
// One instance per consuming service (constructed with that service's own `prisma` — a test
// mock or the real singleton), so the cache is correctly scoped to that instance's lifetime.
export class SystemStaffResolver {
  private systemStaffId: string | undefined;

  constructor(private prisma: PrismaClient) {}

  async resolve(): Promise<string> {
    // Verified, not blindly trusted: a truncated/deleted Staff row (test resets between
    // cases; theoretically a prod cleanup job too) must self-heal on the next call rather
    // than 500 forever on a stale FK. One cheap PK lookup on the common (already-resolved)
    // path, versus a full re-bootstrap only when genuinely needed.
    if (this.systemStaffId != null) {
      const stillExists = await this.prisma.staff.findUnique({ where: { id: this.systemStaffId }, select: { id: true } });
      if (stillExists) return this.systemStaffId;
      this.systemStaffId = undefined;
    }

    const passwordHash = await hashPassword(randomUUID());
    const user = await this.prisma.user.upsert({
      where: { username: SYSTEM_USERNAME },
      update: {},
      create: {
        username: SYSTEM_USERNAME,
        passwordHash,
        type: PrismaUserType.STAFF,
        isEnabled: false,
        staff: { create: { firstName: 'System', lastName: 'Internal' } },
      },
      include: { staff: true },
    });
    if (!user.staff) throw new Error('SystemStaffResolver: system User exists without a linked Staff row');

    this.systemStaffId = user.staff.id;
    return user.staff.id;
  }
}
