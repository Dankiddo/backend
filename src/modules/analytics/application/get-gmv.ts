import type { AnalyticsReader, GmvByToken } from '../domain/index.js';

export interface GetGmvDeps {
  analyticsReader: AnalyticsReader;
}

export interface GetGmvInput {
  /** Inclusive lower bound on the escrow release timestamp (UTC). */
  from?: Date;
  /** Exclusive upper bound on the escrow release timestamp (UTC). */
  to?: Date;
}

/**
 * Grouped by token, never summed across tokens — different Soroban tokens
 * are different units of value, and silently adding them together would
 * produce a meaningless number.
 *
 * When `from`/`to` are supplied, only escrow releases with
 * `releasedAt` in `[from, to)` are included, independent per token.
 * Omitting both preserves the current all-time aggregate.
 */
/**
 * Creates the use case that returns gross merchandise value grouped by token.
 *
 * @param deps - Dependencies required by the use case.
 * @param deps.analyticsReader - Reader used to fetch GMV grouped by token.
 * @returns An async function that takes an optional reporting window
 * (`from`/`to`) and resolves with GMV grouped by token.
 */
export function createGetGmvUseCase(deps: GetGmvDeps) {
  return async function getGmv(input: GetGmvInput = {}): Promise<GmvByToken[]> {
    return deps.analyticsReader.getGmvByToken({
      ...(input.from !== undefined && { from: input.from }),
      ...(input.to !== undefined && { to: input.to }),
    });
  };
}
