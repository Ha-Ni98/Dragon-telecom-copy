import { UserType } from '@dragon-telecom/contract';
import { seedUser, type SeedUserOptions } from './user.factory';

// Staff.userId is a required FK — there is no way to create a bare Staff row without a User, so
// this wraps seedUser(type: STAFF) and hands back just the Staff shape inventory tests need
// (staffId/staffName on StockMovement/StockAdjustment).
export type SeedStaffOptions = Omit<SeedUserOptions, 'type'>;

export const seedStaff = async (options: SeedStaffOptions = {}) => {
  const { user } = await seedUser({ ...options, type: UserType.STAFF });
  if (!user.staff) throw new Error('seedUser did not create a Staff row');
  return user.staff;
};
