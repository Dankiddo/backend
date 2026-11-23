import { describe, expect, it } from 'vitest';
import { gmvQuerySchema, gmvResponseSchema } from './schemas.js';

describe('GMV response schema', () => {
  it('accepts released amounts up to 100 characters', () => {
    expect(
      gmvResponseSchema.safeParse({
        data: [{ token: 'XLM', releasedAmount: '1'.repeat(100), releasedCount: 1 }],
      }).success,
    ).toBe(true);
  });

  it('rejects released amounts longer than 100 characters', () => {
    expect(
      gmvResponseSchema.safeParse({
        data: [{ token: 'XLM', releasedAmount: '1'.repeat(101), releasedCount: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('gmvQuerySchema', () => {
  it('accepts from and to together', () => {
    expect(
      gmvQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts from-only and to-only windows', () => {
    expect(gmvQuerySchema.safeParse({ from: '2026-01-01T00:00:00.000Z' }).success).toBe(true);
    expect(gmvQuerySchema.safeParse({ to: '2026-02-01T00:00:00.000Z' }).success).toBe(true);
  });

  it('accepts omitted window (all-time behavior preserved)', () => {
    expect(gmvQuerySchema.safeParse({}).success).toBe(true);
    expect(gmvQuerySchema.safeParse({}).data).toEqual({});
  });

  it('rejects an invalid from timestamp', () => {
    expect(gmvQuerySchema.safeParse({ from: 'not-a-date' }).success).toBe(false);
  });

  it('rejects an invalid to timestamp', () => {
    expect(gmvQuerySchema.safeParse({ to: '2026-13-01' }).success).toBe(false);
  });

  it('rejects from >= to (inverted or equal range)', () => {
    expect(
      gmvQuerySchema.safeParse({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);

    expect(
      gmvQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('accepts from strictly before to', () => {
    expect(
      gmvQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
