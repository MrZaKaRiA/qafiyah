import type { JSONSchema } from '@orpc/openapi';

export const PROBLEM_DETAIL_SCHEMA: JSONSchema = {
  type: 'object',
  required: ['type', 'title', 'status', 'code'],
  properties: {
    type: { type: 'string', format: 'uri' },
    title: { type: 'string' },
    status: { type: 'integer' },
    code: { type: 'string' },
    instance: { type: 'string' },
    detail: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['message'],
        properties: {
          path: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};
