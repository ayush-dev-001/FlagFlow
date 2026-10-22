import { z } from 'zod';
import { emailInput } from '../auth/schemas.js';

/** Roles an org admin can hand out. SUPERADMIN is never assignable through the API. */
export const orgRole = z.enum(['ADMIN', 'MEMBER']);

export const updateMemberBody = z
  .object({ role: orgRole.optional(), isActive: z.boolean().optional() })
  .refine((b) => b.role !== undefined || b.isActive !== undefined, 'provide role or isActive');

export const createInviteBody = z.object({ email: emailInput, role: orgRole.default('MEMBER') });

export const acceptInviteBody = z.object({
  name: z.string().trim().min(1).max(100),
  password: z
    .string()
    .min(12, 'must be at least 12 characters')
    .max(128)
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'must be at most 72 bytes'),
});

export const member = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'MEMBER']),
  isActive: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const invite = z.object({
  id: z.uuid(),
  email: z.email(),
  role: orgRole,
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const invitePreview = z.object({
  email: z.email(),
  role: orgRole,
  organization: z.object({ name: z.string() }),
});

export const membersResponse = z.object({ members: z.array(member) });
export const invitesResponse = z.object({ invites: z.array(invite) });
