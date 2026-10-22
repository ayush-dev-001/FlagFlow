import { z } from 'zod';
import { Role } from '../generated/prisma/client.js';

// zod objects strip unknown keys, so `role`, `orgId` or `id` in a request body never reach the database.

export const emailInput = z.string().trim().toLowerCase().max(254).pipe(z.email());

const password = z
  .string()
  .min(12, 'must be at least 12 characters')
  .max(128)
  // bcrypt only reads the first 72 bytes; longer passwords would silently share a hash.
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'must be at most 72 bytes');

export const registerBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailInput,
  password,
  organizationName: z.string().trim().min(2).max(100),
});

export const loginBody = z.object({
  email: emailInput,
  password: z.string().min(1).max(128),
});

export const publicUser = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(Role),
});

export const publicOrg = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });

export const accessTokenResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().describe('Seconds until the access token expires'),
});

export const sessionResponse = accessTokenResponse.extend({
  user: publicUser,
  organization: publicOrg.nullable(),
});

export const registerResponse = sessionResponse.extend({
  apiKey: z
    .object({ id: z.uuid(), name: z.string(), prefix: z.string(), key: z.string() })
    .describe('The first API key. `key` is shown only in this response.'),
});

export const meResponse = z.object({ user: publicUser, organization: publicOrg.nullable() });

export const errorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
