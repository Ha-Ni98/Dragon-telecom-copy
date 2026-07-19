import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { PageScope, type UserType as PrismaUserType } from '@prisma/client';
import {
  UserType,
  LoginResultResponseSchema,
  RefreshResultResponseSchema,
  RoleResponseSchema,
  PageResponseSchema,
  TechnicianResponseSchema,
  UserResponseSchema,
  paginated,
} from '@dragon-telecom/contract';
import { app } from '../../src/app';
import { prisma } from '../../src/common/db/prisma';
import { generateToken } from '../../src/common/utils/token.utils';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedPages } from '../data/page.factory';
import { seedUser } from '../data/user.factory';
import { seedRole } from '../data/role.factory';
import { seedRefreshToken } from '../data/refresh-token.factory';

// Real persisted users, not the disconnected auth.fixture's mintAuthToken: admin routes use
// requireAuth({ checkDB: true }), which does a real DB lookup by sub — a fake unpersisted id
// would always 401. Roles/permissions tests also need real UserRole/RolePage rows to exercise.
const mintTokenFor = (user: { id: string; type: PrismaUserType }): string =>
  generateToken({ sub: user.id, type: user.type });

describe('identity integration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedPages();
  });

  describe('POST /api/auth/login', () => {
    it('logs in via username and returns an ApiResponse with tokens', async () => {
      const { user, plainPassword } = await seedUser({ type: UserType.ADMIN });

      const res = await request(app).post('/api/auth/login').send({ username: user.username, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authType).toBe('admin');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(() => LoginResultResponseSchema.parse(res.body.data)).not.toThrow();
    });

    it('logs in via email', async () => {
      const { user, plainPassword } = await seedUser({ type: UserType.STAFF });

      const res = await request(app).post('/api/auth/login').send({ username: user.email, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.data.authType).toBe('staff');
    });

    it('returns byte-identical 401 bodies for unknown username, wrong password, and a disabled user', async () => {
      const { user: disabledUser, plainPassword: disabledPassword } = await seedUser({
        type: UserType.STAFF,
        isEnabled: false,
      });
      const { user: realUser } = await seedUser({ type: UserType.STAFF });

      const unknownRes = await request(app).post('/api/auth/login').send({ username: 'no-such-user', password: 'x' });
      const wrongPasswordRes = await request(app)
        .post('/api/auth/login')
        .send({ username: realUser.username, password: 'DefinitelyWrong1!' });
      const disabledRes = await request(app)
        .post('/api/auth/login')
        .send({ username: disabledUser.username, password: disabledPassword });

      for (const res of [unknownRes, wrongPasswordRes, disabledRes]) {
        expect(res.status).toBe(401);
      }
      expect(unknownRes.body).toEqual(wrongPasswordRes.body);
      expect(wrongPasswordRes.body).toEqual(disabledRes.body);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh token, and reuse of the old one kills the whole chain', async () => {
      const { user } = await seedUser({ type: UserType.STAFF });
      const { token } = await seedRefreshToken({ userId: user.id });

      const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
      expect(rotated.status).toBe(200);
      expect(() => RefreshResultResponseSchema.parse(rotated.body.data)).not.toThrow();
      const newToken = rotated.body.data.refreshToken as string;
      expect(newToken).not.toBe(token);

      const reuseOld = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
      expect(reuseOld.status).toBe(401);

      // Reuse-of-revoked kills the *whole chain*, including the token issued by the rotation above.
      const afterChainKill = await request(app).post('/api/auth/refresh').send({ refreshToken: newToken });
      expect(afterChainKill.status).toBe(401);
    });
  });

  describe('admin users', () => {
    it('creates, lists (paginated), and updates a user', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const role = await seedRole();
      const token = mintTokenFor(admin);

      const createRes = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'newstaffuser',
          email: 'newstaff@example.com',
          password: 'Password123!',
          type: 'STAFF',
          profile: { firstName: 'New', lastName: 'Staff' },
          roleIds: [role.id],
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.username).toBe('newstaffuser');
      expect(() => UserResponseSchema.parse(createRes.body.data)).not.toThrow();

      const listRes = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.meta.total).toBe(2); // the seeded admin + the just-created staff
      expect(listRes.body.data.items).toHaveLength(2);
      expect(() => paginated(UserResponseSchema).parse(listRes.body.data)).not.toThrow();

      const updateRes = await request(app)
        .patch(`/api/admin/users/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: false });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.isEnabled).toBe(false);
    });

    it('blocks disabling the last enabled admin with 409', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const token = mintTokenFor(admin);

      const res = await request(app)
        .patch(`/api/admin/users/${admin.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: false });

      expect(res.status).toBe(409);
    });

    it('disabling a user revokes its refresh tokens (the old refresh now fails)', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(admin);
      const { user: staff } = await seedUser({ type: UserType.STAFF });
      const { token: staffRefreshToken } = await seedRefreshToken({ userId: staff.id });

      const disableRes = await request(app)
        .patch(`/api/admin/users/${staff.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isEnabled: false });
      expect(disableRes.status).toBe(200);

      const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: staffRefreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('roles & pages', () => {
    it('CRUDs a role and assigns STAFF-scope pages via setRolePages', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const token = mintTokenFor(admin);

      const createRes = await request(app)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'CASHIER', name: 'Cashier' });
      expect(createRes.status).toBe(201);
      expect(() => RoleResponseSchema.parse(createRes.body.data)).not.toThrow();
      const roleId = createRes.body.data.id as string;

      const setPagesRes = await request(app)
        .put(`/api/admin/roles/${roleId}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pageKeys: ['STAFF_POS', 'STAFF_SALES'] });
      expect(setPagesRes.status).toBe(200);
      expect(setPagesRes.body.data.pageKeys.sort()).toEqual(['STAFF_POS', 'STAFF_SALES']);

      const listRes = await request(app).get('/api/admin/roles').set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((r: { id: string }) => r.id === roleId)).toBe(true);

      const pagesRes = await request(app).get('/api/admin/pages').set('Authorization', `Bearer ${token}`);
      expect(pagesRes.status).toBe(200);
      expect(pagesRes.body.data.length).toBeGreaterThan(0);
      for (const page of pagesRes.body.data) {
        expect(() => PageResponseSchema.parse(page)).not.toThrow();
      }
    });

    it('rejects an unknown page key with 400', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const token = mintTokenFor(admin);
      const role = await seedRole();

      const res = await request(app)
        .put(`/api/admin/roles/${role.id}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pageKeys: ['NOT_A_REAL_PAGE_KEY'] });

      expect(res.status).toBe(400);
    });

    it('rejects an ADMIN-scope page key with 400 (role_pages accepts STAFF-scope only)', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const token = mintTokenFor(admin);
      const role = await seedRole();
      const adminPage = await prisma.page.create({
        data: { key: 'ADM_DASHBOARD', label: 'Dashboard', group: 'ADMIN', scope: PageScope.ADMIN },
      });

      const res = await request(app)
        .put(`/api/admin/roles/${role.id}/pages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pageKeys: [adminPage.key] });

      expect(res.status).toBe(400);
    });

    it('a disabled role drops its pages from /me/permissions immediately; ADMIN still gets every page', async () => {
      const role = await seedRole({ pageKeys: ['STAFF_POS', 'STAFF_SALES'] });
      const { user: staff } = await seedUser({ type: UserType.STAFF, roleIds: [role.id] });
      const staffToken = mintTokenFor(staff);

      const beforeRes = await request(app).get('/api/me/permissions').set('Authorization', `Bearer ${staffToken}`);
      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.data.sort()).toEqual(['STAFF_POS', 'STAFF_SALES']);

      await prisma.role.update({ where: { id: role.id }, data: { isEnabled: false } });

      const afterRes = await request(app).get('/api/me/permissions').set('Authorization', `Bearer ${staffToken}`);
      expect(afterRes.body.data).toEqual([]);

      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const adminToken = mintTokenFor(admin);
      const adminRes = await request(app).get('/api/me/permissions').set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.body.data.sort()).toEqual(expect.arrayContaining(['STAFF_POS', 'STAFF_SALES']));
    });
  });

  describe('admin technicians', () => {
    it('creates, lists, and toggles isEnabled (no delete route exists)', async () => {
      const { user: admin } = await seedUser({ type: UserType.ADMIN });
      const token = mintTokenFor(admin);

      const createRes = await request(app)
        .post('/api/admin/technicians')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tech One' });
      expect(createRes.status).toBe(201);
      expect(() => TechnicianResponseSchema.parse(createRes.body.data)).not.toThrow();

      const listRes = await request(app).get('/api/admin/technicians').set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      const toggleRes = await request(app)
        .patch(`/api/admin/technicians/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: false });
      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.isEnabled).toBe(false);
    });
  });

  describe('guards', () => {
    it('rejects a non-admin on an admin route with 403', async () => {
      const { user: staff } = await seedUser({ type: UserType.STAFF });
      const token = mintTokenFor(staff);

      const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('rejects a missing token on an admin route with 401', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });
});
