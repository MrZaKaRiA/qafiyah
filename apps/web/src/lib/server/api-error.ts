import { ORPCError } from '@orpc/client';

export function errorStatus(error: unknown): number | null {
  return error instanceof ORPCError ? error.status : null;
}
