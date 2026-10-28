import {
  ErrorResponseSchema,
  HealthResponseSchema,
  InterpretRequestSchema,
  InterpretResponseSchema,
  PlacesResponseSchema,
  PlanRequestSchema,
  PlanResponseSchema,
  StatusResponseSchema,
} from '@rutalibre/contract'
import { Hono } from 'hono'
import { z } from 'zod'

const json = (schema: z.ZodType, io: 'input' | 'output' = 'output') => ({
  'application/json': { schema: z.toJSONSchema(schema, { io }) },
})
const ok = (schema: z.ZodType) => ({ description: 'OK', content: json(schema) })
const error = (description: string) => ({ description, content: json(ErrorResponseSchema) })
const common = {
  400: error('The request did not match the contract.'),
  429: error('Rate limited.'),
  502: error('An external service failed.'),
  503: error('Not configured on this server.'),
}

/** OpenAPI 3.1, generated from the contract's zod schemas (ADR 0013): never edited by hand. */
export function openApiDocument(version: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'RutaLibre API',
      version,
      description: 'Accessible public-transport routing for Santiago.',
    },
    paths: {
      '/v1/health': {
        get: { summary: 'Version and commit', responses: { 200: ok(HealthResponseSchema) } },
      },
      '/v1/status': {
        get: {
          summary: 'Latest elevator and escalator statuses',
          responses: { 200: ok(StatusResponseSchema) },
        },
      },
      '/v1/plan': {
        post: {
          summary: 'Plan an accessible trip',
          requestBody: { required: true, content: json(PlanRequestSchema, 'input') },
          responses: { 200: ok(PlanResponseSchema), ...common },
        },
      },
      '/v1/places': {
        get: {
          summary: 'Place autocomplete, biased to Santiago',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string', minLength: 2, maxLength: 120 },
            },
            {
              name: 'session',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: { 200: ok(PlacesResponseSchema), ...common },
        },
      },
      '/v1/interpret': {
        post: {
          summary: 'Free text to origin and destination',
          requestBody: { required: true, content: json(InterpretRequestSchema, 'input') },
          responses: { 200: ok(InterpretResponseSchema), ...common },
        },
      },
    },
  }
}

export function openApiRoutes(version: string) {
  const doc = openApiDocument(version)
  return new Hono().get('/v1/openapi.json', (c) => c.json(doc))
}
