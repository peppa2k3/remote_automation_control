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
