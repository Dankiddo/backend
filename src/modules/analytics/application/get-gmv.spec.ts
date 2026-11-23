import { describe, expect, it } from 'vitest';
import { createGetGmvUseCase } from './get-gmv.js';
import { createFakeAnalyticsReader } from './__fixtures__/fakes.js';

describe('getGmv', () => {
  it('returns the per-token breakdown as-is, never summed across tokens', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    analyticsReader.setGmv([
      { token: 'USDC', releasedAmount: 1_000_000n, releasedCount: 3 },
      { token: 'XLM', releasedAmount: 500n, releasedCount: 1 },
    ]);
    const getGmv = createGetGmvUseCase({ analyticsReader });

    await expect(getGmv()).resolves.toEqual([
      { token: 'USDC', releasedAmount: 1_000_000n, releasedCount: 3 },
      { token: 'XLM', releasedAmount: 500n, releasedCount: 1 },
    ]);
  });

  it('returns an empty array when nothing has been released yet', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    const getGmv = createGetGmvUseCase({ analyticsReader });

    await expect(getGmv()).resolves.toEqual([]);
  });

  it('forwards the reporting window to the analytics reader', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    analyticsReader.setGmv([
      { token: 'USDC', releasedAmount: 1_000_000n, releasedCount: 3 },
    ]);
    const getGmv = createGetGmvUseCase({ analyticsReader });

    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');

    await getGmv({ from, to });

    expect(analyticsReader.lastGmvFilterCalledWith()).toEqual({ from, to });
  });

  it('forwards no window when omitted (all-time behavior)', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    const getGmv = createGetGmvUseCase({ analyticsReader });

    await getGmv();

    expect(analyticsReader.lastGmvFilterCalledWith()).toBeUndefined();
  });

  it('applies a from-only window', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    const getGmv = createGetGmvUseCase({ analyticsReader });

    await getGmv({ from: new Date('2026-01-01T00:00:00Z') });

    expect(analyticsReader.lastGmvFilterCalledWith()).toEqual({
      from: new Date('2026-01-01T00:00:00Z'),
      to: undefined,
    });
  });

  it('applies a to-only window', async () => {
    const analyticsReader = createFakeAnalyticsReader();
    const getGmv = createGetGmvUseCase({ analyticsReader });

    await getGmv({ to: new Date('2026-02-01T00:00:00Z') });

    expect(analyticsReader.lastGmvFilterCalledWith()).toEqual({
      from: undefined,
      to: new Date('2026-02-01T00:00:00Z'),
    });
  });
});
