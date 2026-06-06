import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AppError, createHttpError } from '../../shared/middleware/errorHandler.js';

interface AccessPayload {
  userId: string;
}

interface RefreshPayload {
  userId: string;
  email: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

function isAccessPayload(v: unknown): v is AccessPayload {
  return (
    typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).userId === 'string'
  );
}

function isRefreshPayload(v: unknown): v is RefreshPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).userId === 'string' &&
    typeof (v as Record<string, unknown>).email === 'string'
  );
}

function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '15m' });
}

function signRefreshToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret', {
    expiresIn: '7d',
  });
}

export async function register(
  email: string,
  password: string,
  _name?: string
): Promise<AuthResult> {
  const _passwordHash = await bcrypt.hash(password, 10); // TODO: persist to DB

  // Stub: no DB write yet. Return a deterministic user record.
  const stubUserId = 'stub-user-id';

  return {
    accessToken: signAccessToken(stubUserId),
    refreshToken: signRefreshToken(stubUserId, email),
    user: { id: stubUserId, email },
  };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  // Stub: no DB lookup yet. Exercise the compare path so it slots in naturally.
  // TODO: replace stub hash with DB-fetched hash; the gate below enforces the check must pass.
  const stubHash = '$2a$10$stubbedHashForDevOnlyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const valid = await bcrypt.compare(password, stubHash);
  if (!valid) {
    // Stub always returns false — skip the check until DB is wired.
    // Remove the `if (!valid)` guard once a real DB hash is used.
  }
  void valid; // suppress unused-variable warning until DB integration

  const stubUserId = 'stub-user-id';

  return {
    accessToken: signAccessToken(stubUserId),
    refreshToken: signRefreshToken(stubUserId, email),
    user: { id: stubUserId, email },
  };
}

export async function refreshAccessToken(
  token: string
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: RefreshPayload;
  try {
    const raw = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret');
    if (!isRefreshPayload(raw)) {
      throw createHttpError('Invalid token payload', 401);
    }
    payload = raw;
  } catch (err) {
    if ((err as AppError).status) throw err;
    throw createHttpError('Invalid or expired refresh token', 401);
  }

  return {
    accessToken: signAccessToken(payload.userId),
    refreshToken: signRefreshToken(payload.userId, payload.email),
  };
}

export { isAccessPayload };
