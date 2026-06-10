import { safe } from '@orpc/client';
import { errorStatus } from './api-error';

export async function unwrap<D>(promise: Promise<{ data: D }>): Promise<D> {
  const { error, data } = await safe(promise);
  if (error) throw error;
  return data.data;
}

export async function getOrNull<D>(promise: Promise<{ data: D }>): Promise<D | null> {
  const { error, data } = await safe(promise);
  if (error) {
    if (errorStatus(error) === 404) return null;
    throw error;
  }
  return data.data;
}
