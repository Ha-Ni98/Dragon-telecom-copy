// Types for PlatformUser and UserLogs

import { UserRole, UserActionType } from '../constants';

export interface PlatformUser {
  idUser: number;
  userName: string;
  userPassword: string;
  userRole: number; // index in userRoles
  userStatue: number;
}

export interface UserLog {
  idLog: number;
  idUser: number;
  useractionType: number; // index in userActionTypes
  actionDetails: string;
  logCreatedDate: string | Date;
}
