import type { DbClient } from '@qafiyah/db';
import type { SearchClient } from '@qafiyah/search';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import * as v from 'valibot';
import { vi } from 'vitest';
import type { AppContext, Bindings } from '@/types';

function createMockDrizzleQueryBuilder(mockData: readonly unknown[] = []) {
  const limitMock = vi.fn();
  limitMock.mockReturnValue({
    offset: vi.fn().mockResolvedValue(mockData),
  });
  limitMock.mockResolvedValue(mockData);

  const whereMock = vi.fn().mockReturnValue({
    limit: limitMock,
  });

  const builder = {
    from: vi.fn().mockResolvedValue(mockData),
    where: whereMock,
    limit: limitMock,
    offset: vi.fn().mockResolvedValue(mockData),
  };

  return builder;
}

function castPartialAsDbClient<T extends object>(partial: T): DbClient {
  return partial as unknown as DbClient;
}

export function createMockDb(defaultData: readonly unknown[] = []): DbClient {
  const defaultBuilder = createMockDrizzleQueryBuilder(defaultData);

  return castPartialAsDbClient({
    select: vi.fn().mockReturnValue(defaultBuilder),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    $count: vi.fn().mockResolvedValue(0),
  });
}

type TestClientWithGet = {
  readonly $get: (path: string, init?: RequestInit) => Promise<Response>;
};

function createTestContextMiddleware(db: DbClient, es: SearchClient) {
  return createMiddleware<AppContext>(async (c, next) => {
    c.set('db', db);
    c.set('es', es);
    await next();
  });
}

export function createTestClient<T extends Hono<AppContext>>(
  app: T,
  options?: {
    readonly db?: DbClient;
    readonly es?: SearchClient;
    readonly bindings?: Partial<Bindings>;
  }
): TestClientWithGet {
  const db = options?.db ?? createMockDb();
  const es = options?.es ?? ({} as unknown as SearchClient);
  const bindings = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    ...options?.bindings,
  } satisfies Bindings;

  const testApp = new Hono<AppContext>();
  testApp.use(createTestContextMiddleware(db, es));
  testApp.route('/', app);

  return {
    $get: (path: string, init?: RequestInit): Promise<Response> => {
      return Promise.resolve(
        testApp.fetch(
          new Request(`http://localhost${path}`, {
            method: 'GET',
            ...init,
          }),
          bindings
        )
      );
    },
  };
}

export async function parseJson<TSchema extends v.GenericSchema>(
  res: Response,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> {
  const body: unknown = await res.json();
  return v.parse(schema, body);
}
