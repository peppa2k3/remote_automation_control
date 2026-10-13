import { z } from 'zod';

export const CONTRACT_VERSION = 1;
export const SESSION_COOKIE_NAME = 'automation_session';
export const userRoleSchema = z.enum(['OWNER', 'ADMIN', 'VIEWER']);
export type UserRole = z.infer<typeof userRoleSchema>;
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: userRoleSchema,
  mfaEnabled: z.boolean(),
});
export const authDataSchema = z.object({
  user: publicUserSchema,
  csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  sessionExpiresAt: z.iso.datetime(),
});
export const loginInputSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.trim().toLowerCase()),
    password: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => new TextEncoder().encode(value).byteLength <= 128),
  })
  .strict();
export const apiErrorSchema = z.object({ code: z.string(), message: z.string() });

export function apiResponseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data, error: z.null(), requestId: z.uuid() }),
    z.object({
      success: z.literal(false),
      data: z.null(),
      error: apiErrorSchema,
      requestId: z.uuid(),
    }),
  ]);
}

export const healthDataSchema = z.object({
  service: z.literal('backend'),
  status: z.literal('ok'),
  timestamp: z.iso.datetime(),
  database: z.literal('up').optional(),
});
export const healthResponseSchema = apiResponseSchema(healthDataSchema);
export const authResponseSchema = apiResponseSchema(authDataSchema);
export type AuthData = z.infer<typeof authDataSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type HealthData = z.infer<typeof healthDataSchema>;

export const DEVICE_SCOPES = ['agent:heartbeat', 'agent:rotate'] as const;
export const deviceTokenSchema = z.string().regex(/^agt_[a-f0-9]{64}$/);
export const pairingCodeSchema = z.string().regex(/^pair_[a-f0-9]{32}$/);
export const agentMetadataSchema = z
  .object({
    platform: z.literal('win32'),
    arch: z.enum(['x64', 'arm64']),
    version: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/),
    capabilities: z
      .array(z.enum(['diagnostics', 'heartbeat']))
      .min(1)
      .max(2)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict();
export const pairInputSchema = agentMetadataSchema
  .extend({
    code: pairingCodeSchema,
    label: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) =>
        Array.from(value).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127),
      ),
  })
  .strict();
export const rotateInputSchema = z.object({ token: deviceTokenSchema }).strict();
export const emptyInputSchema = z.object({}).strict();
export const deviceIdentitySchema = z.object({
  deviceId: z.uuid(),
  scopes: z.array(z.enum(DEVICE_SCOPES)),
  credentialExpiresAt: z.iso.datetime(),
});
export const devicePairResponseSchema = apiResponseSchema(
  deviceIdentitySchema.extend({ token: deviceTokenSchema }),
);
export const deviceIdentityResponseSchema = apiResponseSchema(deviceIdentitySchema);
export const heartbeatResponseSchema = apiResponseSchema(
  z.object({
    deviceId: z.uuid(),
    serverTime: z.iso.datetime(),
    heartbeatAfterSeconds: z.number().int().min(10).max(300),
  }),
);
export const pairingResponseSchema = apiResponseSchema(
  z.object({ code: pairingCodeSchema, expiresAt: z.iso.datetime() }),
);
export const deviceSchema = agentMetadataSchema.extend({
  id: z.uuid(),
  label: z.string(),
  lastSeenAt: z.iso.datetime().nullable(),
  onlineState: z.enum(['ONLINE', 'OFFLINE', 'REVOKED']),
  revokedAt: z.iso.datetime().nullable(),
  credentialFingerprint: z
    .string()
    .regex(/^[a-f0-9]{12}$/)
    .nullable(),
});
export const devicesResponseSchema = apiResponseSchema(z.array(deviceSchema));
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;
export type DeviceIdentity = z.infer<typeof deviceIdentitySchema>;
export type DeviceView = z.infer<typeof deviceSchema>;

export interface ApiError {
  code: string;
  message: string;
}
export type ApiResponse<T> =
  | { success: true; data: T; error: null; requestId: string }
  | { success: false; data: null; error: ApiError; requestId: string };

export function success<T>(data: T, requestId: string): ApiResponse<T> {
  return { success: true, data, error: null, requestId };
}
export function failure(code: string, message: string, requestId: string): ApiResponse<never> {
  return { success: false, data: null, error: { code, message }, requestId };
}
