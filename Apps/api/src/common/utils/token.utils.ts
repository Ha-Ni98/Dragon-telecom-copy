import jwt from 'jsonwebtoken';
import { env } from '../../env';

export const generateToken = (payload: object): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRATION as NonNullable<jwt.SignOptions['expiresIn']>,
  });

export const verifyToken = (token: string): string | jwt.JwtPayload => jwt.verify(token, env.JWT_SECRET);
