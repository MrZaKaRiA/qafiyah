// biome-ignore lint/style/noProcessEnv: test-only helper reads env directly to gate integration tests
const ES_URL = process.env['ELASTICSEARCH_URL'] ?? '';

export const ES_TEST_URL = ES_URL;
export const RUN_ES_INTEGRATION = ES_URL !== '';
