import { z } from 'zod';

export const MAX_TARGETS_PER_REQUEST = 1000;
export const MAX_TARGETS_PER_FLAG = 10_000;

export const flagKey = z
  .string()
  .regex(/^[a-z0-9_]{2,64}$/, 'use 2-64 lowercase letters, digits or underscores');

/** End-user IDs are the customer's own identifiers (e.g. U001), never FlagFlow accounts. */
export const endUserId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.:@-]+$/, 'use letters, digits and _ . : @ - only');

const targetList = z
  .array(endUserId)
  .max(MAX_TARGETS_PER_REQUEST)
  .transform((ids) => [...new Set(ids)]);

const description = z.string().trim().max(500);

export const createFlagBody = z.object({
  key: flagKey,
  description: description.default(''),
  targetAll: z.boolean().default(false),
  targets: targetList.default([]),
});

export const updateFlagBody = z
  .object({ description: description.optional(), targetAll: z.boolean().optional() })
  .refine(
    (b) => b.description !== undefined || b.targetAll !== undefined,
    'provide description or targetAll',
  );

export const targetsBody = z
  .object({ add: targetList.default([]), remove: targetList.default([]) })
  .refine((b) => b.add.length > 0 || b.remove.length > 0, 'provide add or remove')
  .refine((b) => !b.add.some((id) => b.remove.includes(id)), 'an id cannot be in both add and remove');

export const flagState = z.enum(['inactive', 'testing', 'live']);

export const listFlagsQuery = z.object({
  search: z.string().trim().max(64).optional(),
  state: flagState.optional(),
});

export const auditQuery = z.object({
  flagId: z.uuid().optional(),
  actorId: z.uuid().optional(),
  cursor: z
    .string()
    .regex(/^\d{1,18}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const person = z.object({ id: z.uuid(), name: z.string() }).nullable();

export const flagSummary = z.object({
  id: z.uuid(),
  key: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  targetAll: z.boolean(),
  state: flagState,
  version: z.number().int(),
  targetCount: z.number().int(),
  createdBy: person,
  updatedBy: person,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const flagDetail = flagSummary.extend({ targets: z.array(z.string()) });

export const endUserFlags = z.object({
  endUserId: z.string(),
  flags: z.array(
    z.object({
      id: z.uuid(),
      key: z.string(),
      description: z.string(),
      enabled: z.boolean().describe('What this user gets: the evaluation result'),
      targeted: z.boolean().describe('The user is in this flag’s target list'),
      flagEnabled: z.boolean(),
      targetAll: z.boolean(),
    }),
  ),
});

export const auditPage = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      flagId: z.uuid().nullable(),
      actor: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).nullable(),
      metadata: z.unknown(),
      ip: z.string().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
