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

// OpenAPI 3.1 built from the same zod schemas the routes validate with, so the docs can't drift from the code.
// Each phase adds its routes here.

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
};

export function buildOpenApi() {
  const paths = Object.fromEntries(
    Object.entries(routes).map(([path, methods]) => [
      path,
      Object.fromEntries(
        Object.entries(methods).map(([method, doc]) => [
          method,
          {
            summary: doc.summary,
            tags: [doc.tag],
            ...(doc.auth === 'bearer' && { security: [{ bearer: [] }] }),
            ...(doc.auth === 'refreshCookie' && {
              security: [{ refreshCookie: [] }],
              parameters: [
                { name: 'X-Requested-With', in: 'header', required: true, schema: { type: 'string' } },
              ],
            }),
            ...(doc.body && { requestBody: { required: true, content: json(doc.body, 'input') } }),
            responses: Object.fromEntries(
              Object.entries(doc.responses).map(([status, r]) => [
                status,
                { description: r.description, ...(r.schema && { content: json(r.schema, 'output') }) },
              ]),
            ),
          },
        ]),
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
