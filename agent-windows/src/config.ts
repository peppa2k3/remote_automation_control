import { z } from 'zod';

const schema = z
  .object({
    AGENT_API_BASE_URL: z.url(),
    AGENT_ALLOW_LOCAL_HTTP: z.enum(['true', 'false']).default('false'),
    AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  })
  .superRefine((config, context) => {
    const url = new URL(config.AGENT_API_BASE_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' &&
        !(config.AGENT_ALLOW_LOCAL_HTTP === 'true' && url.protocol === 'http:' && local)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Agent requires HTTPS; local HTTP must be explicitly enabled',
      });
    }
  });
export function parseAgentConfig(env: NodeJS.ProcessEnv) {
  return schema.parse(env);
}
export type AgentConfig = ReturnType<typeof parseAgentConfig>;
