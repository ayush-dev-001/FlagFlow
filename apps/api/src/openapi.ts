import { Router } from 'express';
import { z } from 'zod';
import {
  accessTokenResponse,
  errorResponse,
  loginBody,
  meResponse,
  registerBody,
  registerResponse,
  sessionResponse,
} from './auth/schemas.js';
import {
  acceptInviteBody,
  createInviteBody,
  invite,
  invitePreview,
  invitesResponse,
  member,
  membersResponse,
  updateMemberBody,
} from './team/schemas.js';
import {
  auditPage,
  auditQuery,
  createFlagBody,
  endUserFlags,
  flagDetail,
  flagSummary,
  listFlagsQuery,
  targetsBody,
  updateFlagBody,
} from './flags/schemas.js';
import { organizationSummary, updateOrgStatusBody } from './admin/routes.js';
import { apiKeySummary, createApiKeyBody, updateOrgBody } from './org/routes.js';
import { evaluateQuery } from './public/routes.js';

const orgResponse = z.object({
  organization: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
});
const snapshotSchema = z.object({
  version: z.number().int(),
  flags: z.array(
    z.object({ key: z.string(), enabled: z.boolean(), targetAll: z.boolean(), targets: z.array(z.string()) }),
  ),
});

const flagResponse = z.object({ flag: flagDetail });

// OpenAPI 3.1 built from the same zod schemas the routes validate with, so the docs can't drift from the code.
// Each phase adds its routes here. `{name}` segments in a path become required path parameters.

type Schema = z.ZodType;
interface RouteDoc {
  summary: string;
  tag: string;
  body?: Schema;
  /** An object schema whose keys become optional query parameters. */
  query?: z.ZodObject;
  auth?: 'bearer' | 'refreshCookie' | 'apiKey';
  responses: Record<number, { description: string; schema?: Schema }>;
}

const json = (schema: Schema, io: 'input' | 'output') => ({
  'application/json': {
    schema: z.toJSONSchema(schema, { io, target: 'openapi-3.0', unrepresentable: 'any' }),
  },
});

const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [c, { description: 'Error', schema: errorResponse }]));

const routes: Record<string, Record<string, RouteDoc>> = {
  '/api/health': {
    get: {
      summary: 'Health of Postgres and Redis',
      tag: 'System',
      responses: { 200: { description: 'Healthy' }, 503: { description: 'A dependency is down' } },
    },
  },
  '/api/auth/register': {
    post: {
      summary: 'Create an organization and its first admin',
      tag: 'Auth',
      body: registerBody,
      responses: { 201: { description: 'Registered', schema: registerResponse }, ...errors(400, 409, 429) },
    },
  },
  '/api/auth/login': {
    post: {
      summary: 'Log in',
      tag: 'Auth',
      body: loginBody,
      responses: {
        200: { description: 'Logged in', schema: sessionResponse },
        ...errors(400, 401, 403, 429),
      },
    },
  },
  '/api/auth/refresh': {
    post: {
      summary: 'Rotate the refresh cookie and get a new access token',
      tag: 'Auth',
      auth: 'refreshCookie',
      responses: { 200: { description: 'Refreshed', schema: accessTokenResponse }, ...errors(401, 403, 429) },
    },
  },
  '/api/auth/logout': {
    post: {
      summary: 'Revoke the session and access token',
      tag: 'Auth',
      auth: 'bearer',
      responses: { 204: { description: 'Logged out' }, ...errors(401) },
    },
  },
  '/api/auth/me': {
    get: {
      summary: 'Current user and organization',
      tag: 'Auth',
      auth: 'bearer',
      responses: { 200: { description: 'Current user', schema: meResponse }, ...errors(401) },
    },
  },
  '/api/auth/invites/{token}': {
    get: {
      summary: 'Preview an invite',
      tag: 'Auth',
      responses: { 200: { description: 'Invite', schema: invitePreview }, ...errors(404, 429) },
    },
  },
  '/api/auth/invites/{token}/accept': {
    post: {
      summary: 'Accept an invite and log in',
      tag: 'Auth',
      body: acceptInviteBody,
      responses: { 201: { description: 'Joined', schema: sessionResponse }, ...errors(400, 404, 409, 429) },
    },
  },
  '/api/team/members': {
    get: {
      summary: 'Members of the organization',
      tag: 'Team',
      auth: 'bearer',
      responses: { 200: { description: 'Members', schema: membersResponse }, ...errors(401, 403) },
    },
  },
  '/api/team/members/{id}': {
    patch: {
      summary: "Change a member's role or active status (admin)",
      tag: 'Team',
      auth: 'bearer',
      body: updateMemberBody,
      responses: {
        200: { description: 'Updated', schema: z.object({ member }) },
        ...errors(400, 401, 403, 404, 409),
      },
    },
  },
  '/api/team/invites': {
    get: {
      summary: 'Invites of the organization (admin)',
      tag: 'Team',
      auth: 'bearer',
      responses: { 200: { description: 'Invites', schema: invitesResponse }, ...errors(401, 403) },
    },
    post: {
      summary: 'Invite someone by email (admin)',
      tag: 'Team',
      auth: 'bearer',
      body: createInviteBody,
      responses: {
        201: { description: 'Invited', schema: z.object({ invite }) },
        ...errors(400, 401, 403, 409),
      },
    },
  },
  '/api/team/invites/{id}': {
    delete: {
      summary: 'Revoke a pending invite (admin)',
      tag: 'Team',
      auth: 'bearer',
      responses: { 204: { description: 'Revoked' }, ...errors(401, 403, 404) },
    },
  },
  '/api/flags': {
    get: {
      summary: 'Flags, filterable by search text and board state',
      tag: 'Flags',
      auth: 'bearer',
      query: listFlagsQuery,
      responses: {
        200: { description: 'Flags', schema: z.object({ flags: z.array(flagSummary) }) },
        ...errors(400, 401, 403),
      },
    },
    post: {
      summary: 'Create a flag (always starts off)',
      tag: 'Flags',
      auth: 'bearer',
      body: createFlagBody,
      responses: { 201: { description: 'Created', schema: flagResponse }, ...errors(400, 401, 403, 409) },
    },
  },
  '/api/flags/connections': {
    get: {
      summary: 'Open SDK streams for the organization, across instances',
      tag: 'Flags',
      auth: 'bearer',
      responses: {
        200: { description: 'Count', schema: z.object({ connectedClients: z.number().int() }) },
        ...errors(401, 403),
      },
    },
  },
  '/api/flags/{id}': {
    get: {
      summary: 'A flag with its targets',
      tag: 'Flags',
      auth: 'bearer',
      responses: { 200: { description: 'Flag', schema: flagResponse }, ...errors(401, 403, 404) },
    },
    patch: {
      summary: 'Change description or all-users targeting',
      tag: 'Flags',
      auth: 'bearer',
      body: updateFlagBody,
      responses: { 200: { description: 'Updated', schema: flagResponse }, ...errors(400, 401, 403, 404) },
    },
    delete: {
      summary: 'Delete a flag (admin)',
      tag: 'Flags',
      auth: 'bearer',
      responses: { 204: { description: 'Deleted' }, ...errors(401, 403, 404) },
    },
  },
  '/api/flags/{id}/toggle': {
    post: {
      summary: 'Turn a flag on or off',
      tag: 'Flags',
      auth: 'bearer',
      responses: { 200: { description: 'Toggled', schema: flagResponse }, ...errors(401, 403, 404) },
    },
  },
  '/api/flags/{id}/targets': {
    post: {
      summary: 'Add or remove targeted end-user ids',
      tag: 'Flags',
      auth: 'bearer',
      body: targetsBody,
      responses: { 200: { description: 'Updated', schema: flagResponse }, ...errors(400, 401, 403, 404) },
    },
  },
  '/api/end-users/{endUserId}/flags': {
    get: {
      summary: 'Every flag and what one end user gets',
      tag: 'Flags',
      auth: 'bearer',
      responses: {
        200: { description: 'Flags for the user', schema: endUserFlags },
        ...errors(400, 401, 403),
      },
    },
  },
  '/api/audit-logs': {
    get: {
      summary: 'Audit log, newest first, cursor-paginated (admin)',
      tag: 'Audit',
      auth: 'bearer',
      query: auditQuery,
      responses: { 200: { description: 'Entries', schema: auditPage }, ...errors(400, 401, 403) },
    },
  },
  '/api/admin/organizations': {
    get: {
      summary: 'Every organization on this instance (superadmin)',
      tag: 'Superadmin',
      auth: 'bearer',
      responses: {
        200: {
          description: 'Organizations',
          schema: z.object({ organizations: z.array(organizationSummary) }),
        },
        ...errors(401, 403),
      },
    },
  },
  '/api/admin/organizations/{id}': {
    patch: {
      summary:
        'Activate or deactivate an organization; deactivating ends its sessions and streams (superadmin)',
      tag: 'Superadmin',
      auth: 'bearer',
      body: updateOrgStatusBody,
      responses: {
        200: { description: 'Updated', schema: z.object({ organization: organizationSummary }) },
        ...errors(400, 401, 403, 404),
      },
    },
  },
  '/api/org': {
    get: {
      summary: 'The organization (admin)',
      tag: 'Organization',
      auth: 'bearer',
      responses: { 200: { description: 'Organization', schema: orgResponse }, ...errors(401, 403) },
    },
    patch: {
      summary: 'Rename the organization (admin)',
      tag: 'Organization',
      auth: 'bearer',
      body: updateOrgBody,
      responses: { 200: { description: 'Updated', schema: orgResponse }, ...errors(400, 401, 403) },
    },
  },
  '/api/org/api-keys': {
    get: {
      summary: 'API keys, without their secrets (admin)',
      tag: 'Organization',
      auth: 'bearer',
      responses: {
        200: { description: 'Keys', schema: z.object({ apiKeys: z.array(apiKeySummary) }) },
        ...errors(401, 403),
      },
    },
    post: {
      summary: 'Create an API key; the full key is only in this response (admin)',
      tag: 'Organization',
      auth: 'bearer',
      body: createApiKeyBody,
      responses: {
        201: {
          description: 'Created',
          schema: z.object({ apiKey: apiKeySummary.extend({ key: z.string() }) }),
        },
        ...errors(400, 401, 403, 409),
      },
    },
  },
  '/api/org/api-keys/{id}': {
    delete: {
      summary: 'Revoke an API key; open streams using it are closed (admin)',
      tag: 'Organization',
      auth: 'bearer',
      responses: { 204: { description: 'Revoked' }, ...errors(401, 403, 404) },
    },
  },
  '/v1/flags/evaluate': {
    get: {
      summary: 'Every flag evaluated for one end user',
      tag: 'Public',
      auth: 'apiKey',
      query: evaluateQuery,
      responses: {
        200: {
          description: 'Flag values',
          schema: z.object({ version: z.number().int(), flags: z.record(z.string(), z.boolean()) }),
        },
        ...errors(400, 401, 429),
      },
    },
  },
  '/v1/flags/{key}/evaluate': {
    get: {
      summary: 'One flag for one end user (unknown flags are off)',
      tag: 'Public',
      auth: 'apiKey',
      query: evaluateQuery,
      responses: {
        200: { description: 'Value', schema: z.object({ version: z.number().int(), enabled: z.boolean() }) },
        ...errors(400, 401, 429),
      },
    },
  },
  '/v1/snapshot': {
    get: {
      summary: 'Full rule set, for local evaluation',
      tag: 'Public',
      auth: 'apiKey',
      responses: { 200: { description: 'Snapshot', schema: snapshotSchema }, ...errors(401, 429) },
    },
  },
  '/v1/stream': {
    get: {
      summary:
        'Server-sent events: `snapshot` on connect, then `flag.updated` / `flag.deleted` (id = version). ' +
        'Send Last-Event-ID to resume; `: ping` heartbeats every 25s.',
      tag: 'Public',
      auth: 'apiKey',
      responses: { 200: { description: 'text/event-stream' }, ...errors(401, 429) },
    },
  },
};

const pathParams = (path: string) =>
  [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

export function buildOpenApi() {
  const paths = Object.fromEntries(
    Object.entries(routes).map(([path, methods]) => [
      path,
      Object.fromEntries(
        Object.entries(methods).map(([method, doc]) => {
          const parameters = [
            ...pathParams(path),
            ...Object.keys(doc.query?.shape ?? {}).map((name) => ({
              name,
              in: 'query',
              required: false,
              schema: { type: 'string' },
            })),
            ...(doc.auth === 'refreshCookie'
              ? [{ name: 'X-Requested-With', in: 'header', required: true, schema: { type: 'string' } }]
              : []),
          ];
          return [
            method,
            {
              summary: doc.summary,
              tags: [doc.tag],
              ...(doc.auth && { security: [{ [doc.auth]: [] }] }),
              ...(parameters.length > 0 && { parameters }),
              ...(doc.body && { requestBody: { required: true, content: json(doc.body, 'input') } }),
              responses: Object.fromEntries(
                Object.entries(doc.responses).map(([status, r]) => [
                  status,
                  { description: r.description, ...(r.schema && { content: json(r.schema, 'output') }) },
                ]),
              ),
            },
          ];
        }),
      ),
    ]),
  );

  return {
    openapi: '3.1.0',
    info: {
      title: 'FlagFlow API',
      version: '1.0.0',
      description:
        'Dashboard API under /api (JWT bearer, refresh cookie) and the public flag API under /v1 (x-api-key). Errors share one shape: { error: { code, message, details? } }.',
    },
    // Tools (Postman, ZAP) replace this origin; the deployed API serves the same paths.
    servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'ff_refresh' },
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
    paths,
  };
}

export function docsRouter(): Router {
  const doc = buildOpenApi();
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(doc);
  });
  return router;
}
