import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { Role } from '../generated/prisma/client.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ISSUER = 'flagflow';
const AUDIENCE = 'flagflow-dashboard';

export interface AccessClaims {
  userId: string;
  orgId: string | null;
  role: Role;
  sid: string;
  jti: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
  org: z.uuid().nullable(),
  role: z.enum(Role),
  exp: z.number().int(),
});

const keyFor = (secret: string) => new TextEncoder().encode(secret);

export async function signAccessToken(
  secret: string,
  { userId, orgId, role, sid }: Omit<AccessClaims, 'jti' | 'exp'>,
): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({ org: orgId, role, sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(keyFor(secret));
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/** Throws on a bad signature, wrong algorithm, issuer or audience, expiry, or malformed claims. */
export async function verifyAccessToken(secret: string, token: string): Promise<AccessClaims> {
  // `algorithms` pins HS256, which rejects `alg: none` and any algorithm-confusion attempt.
  const { payload } = await jwtVerify(token, keyFor(secret), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const c = claimsSchema.parse(payload);
  return { userId: c.sub, orgId: c.org, role: c.role, sid: c.sid, jti: c.jti, exp: c.exp };
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Refresh tokens are `<session id>.<32 random bytes>`; only their SHA-256 is stored. */
export function newRefreshToken(sid: string): { token: string; hash: string } {
  const token = `${sid}.${randomBytes(32).toString('base64url')}`;
  return { token, hash: sha256(token) };
}

const REFRESH_TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9_-]{43}$/;

export function parseRefreshToken(token: string): { sid: string; hash: string } | null {
  const sid = REFRESH_TOKEN.exec(token)?.[1];
  return sid ? { sid, hash: sha256(token) } : null;
}
