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

// OpenAPI 3.1 built from the same zod schemas the routes validate with, so the docs can't drift from the code.
// Each phase adds its routes here. `{name}` segments in a path become required path parameters.

type Schema = z.ZodType;
interface RouteDoc {
  summary: string;
  tag: string;
  body?: Schema;
  auth?: 'bearer' | 'refreshCookie';
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
    info: { title: 'FlagFlow API', version: '0.1.0' },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'ff_refresh' },
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
