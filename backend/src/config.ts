import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(?:ql)?:\/\//)
      .optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === 'production' &&
      (!config.DATABASE_URL || !config.FRONTEND_ORIGIN.startsWith('https://'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Production requires DATABASE_URL and HTTPS FRONTEND_ORIGIN',
      });
    }
  });

export function parseConfig(env: NodeJS.ProcessEnv) {
  return schema.parse(env);
}
export type Config = ReturnType<typeof parseConfig>;
