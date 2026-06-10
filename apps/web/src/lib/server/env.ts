import { DEV_API_PORT } from '@qafiyah/constants';
import * as v from 'valibot';

const urlSchema = v.pipe(v.string(), v.url());

export function resolveInternalApiUrl(raw: string | undefined): string {
  const candidate = raw ?? `http://localhost:${DEV_API_PORT}`;
  const parsed = v.safeParse(urlSchema, candidate);
  if (!parsed.success) {
    throw new Error(`INTERNAL_API_URL is not a valid URL: ${JSON.stringify(candidate)}`);
  }
  return parsed.output;
}

export const INTERNAL_API_URL = resolveInternalApiUrl(process.env['INTERNAL_API_URL']);
