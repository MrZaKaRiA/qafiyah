import app from './app';
import { type Bindings, parseBindings } from './env';

const DEFAULT_PORT = 8787;

export function createFetchHandler(env: Bindings) {
  return (request: Request): Response | Promise<Response> => app.fetch(request, env);
}

function boot(): { port: number; fetch: ReturnType<typeof createFetchHandler> } {
  const result = parseBindings(process.env);
  if (result.isErr()) {
    console.error(JSON.stringify({ source: 'server', stage: 'boot', error: result.error }));
    process.exit(1);
  }
  const bindings = result.value;
  return {
    port: Number(process.env['PORT'] ?? DEFAULT_PORT),
    fetch: createFetchHandler(bindings),
  };
}

export default import.meta.main ? boot() : null;
