import { describe, expect, it } from 'vitest';
import { failure, healthResponseSchema, success } from '../src/index.js';

const requestId = 'd1b26b3a-2611-4d8d-90ad-379c099b5f0a';
describe('health protocol', () => {
  it('accepts valid health and rejects a false success with missing timestamp', () => {
    expect(
      healthResponseSchema.safeParse(
        success(
          { service: 'backend', status: 'ok', timestamp: new Date().toISOString() },
          requestId,
        ),
      ).success,
    ).toBe(true);
    expect(
      healthResponseSchema.safeParse(success({ service: 'backend', status: 'ok' }, requestId))
        .success,
    ).toBe(false);
  });
  it('enforces mutually exclusive success/error data', () => {
    expect(
      healthResponseSchema.safeParse(failure('UNAVAILABLE', 'Unavailable', requestId)).success,
    ).toBe(true);
    expect(
      healthResponseSchema.safeParse({ success: false, data: {}, error: null, requestId }).success,
    ).toBe(false);
    expect(
      healthResponseSchema.safeParse({
        ...failure('X', 'X', requestId),
        requestId: 'unsafe-header',
      }).success,
    ).toBe(false);
  });
});
