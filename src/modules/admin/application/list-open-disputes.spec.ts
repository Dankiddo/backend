import { describe, expect, it } from 'vitest';
import { createListOpenDisputesUseCase } from './list-open-disputes.js';
import { buildDisputeReviewItem, createFakeDisputeReviewReader } from './__fixtures__/fakes.js';

describe('listOpenDisputes', () => {
  it('returns whatever the reader provides', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    const first = buildDisputeReviewItem({ chainDeliveryId: 7n });
    const second = buildDisputeReviewItem({
      chainDeliveryId: 8n,
      raisedAt: new Date('2026-01-02T00:00:00Z'),
    });
    disputeReviewReader.seed([first, second]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ limit: 1 });

    expect(result).toEqual({
      items: [first],
      nextCursor: '2026-01-01T00:00:00.000Z|7',
      limit: 1,
    });
  });

  it('returns an empty array when nothing is open', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    await expect(listOpenDisputes()).resolves.toEqual({
      items: [],
      nextCursor: null,
      limit: 50,
    });
  });

  it('continues after a cursor with matching timestamps', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    const first = buildDisputeReviewItem({ chainDeliveryId: 7n });
    const second = buildDisputeReviewItem({
      chainDeliveryId: 8n,
      raisedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const third = buildDisputeReviewItem({
      chainDeliveryId: 9n,
      raisedAt: new Date('2026-01-02T00:00:00Z'),
    });
    disputeReviewReader.seed([first, second, third]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ after: '2026-01-01T00:00:00.000Z|8' });

    expect(result).toEqual({ items: [third], nextCursor: null, limit: 50 });
  });

  it('caps the page size and returns a cursor when more results exist', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed(
      Array.from({ length: 202 }, (_, index) =>
        buildDisputeReviewItem({
          chainDeliveryId: BigInt(index + 1),
          raisedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
        }),
      ),
    );
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ limit: 500 });

    expect(result.items).toHaveLength(200);
    expect(result.limit).toBe(200);
    expect(result.nextCursor).toBe('2026-01-01T00:03:19.000Z|200');
  });

  it('rejects malformed cursors', async () => {
    const listOpenDisputes = createListOpenDisputesUseCase({
      disputeReviewReader: createFakeDisputeReviewReader(),
    });

    await expect(listOpenDisputes({ after: 'not-a-cursor' })).rejects.toThrow(
      'Invalid dispute cursor',
    );
  });

  it('filters by raisedBy, returning only that raiser\'s open disputes', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed([
      buildDisputeReviewItem({ chainDeliveryId: 7n, raisedBy: 'GRAISER1' }),
      buildDisputeReviewItem({ chainDeliveryId: 8n, raisedBy: 'GRAISER2' }),
      buildDisputeReviewItem({ chainDeliveryId: 9n, raisedBy: 'GRAISER1' }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ raisedBy: 'GRAISER1' });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.chainDeliveryId)).toEqual([7n, 9n]);
    expect(result.items.every((i) => i.raisedBy === 'GRAISER1')).toBe(true);
  });

  it('filters by raisedAfter (inclusive) and raisedBefore (exclusive)', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed([
      buildDisputeReviewItem({
        chainDeliveryId: 7n,
        raisedAt: new Date('2026-01-01T00:00:00Z'),
      }),
      buildDisputeReviewItem({
        chainDeliveryId: 8n,
        raisedAt: new Date('2026-01-02T00:00:00Z'),
      }),
      buildDisputeReviewItem({
        chainDeliveryId: 9n,
        raisedAt: new Date('2026-01-03T00:00:00Z'),
      }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({
      raisedAfter: new Date('2026-01-01T00:00:00Z'),
      raisedBefore: new Date('2026-01-03T00:00:00Z'),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.chainDeliveryId)).toEqual([7n, 8n]);
  });

  it('applies a from-only bound', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed([
      buildDisputeReviewItem({ chainDeliveryId: 7n, raisedAt: new Date('2026-01-01T00:00:00Z') }),
      buildDisputeReviewItem({ chainDeliveryId: 8n, raisedAt: new Date('2026-01-02T00:00:00Z') }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ raisedAfter: new Date('2026-01-02T00:00:00Z') });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.chainDeliveryId).toBe(8n);
  });

  it('applies a to-only bound', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed([
      buildDisputeReviewItem({ chainDeliveryId: 7n, raisedAt: new Date('2026-01-01T00:00:00Z') }),
      buildDisputeReviewItem({ chainDeliveryId: 8n, raisedAt: new Date('2026-01-02T00:00:00Z') }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ raisedBefore: new Date('2026-01-02T00:00:00Z') });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.chainDeliveryId).toBe(7n);
  });

  it('composes raisedBy and time filters with the cursor without duplicates', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    const base = new Date('2026-01-01T00:00:00Z');
    disputeReviewReader.seed([
      buildDisputeReviewItem({ chainDeliveryId: 7n, raisedBy: 'GRAISER1', raisedAt: base }),
      buildDisputeReviewItem({
        chainDeliveryId: 8n,
        raisedBy: 'GRAISER1',
        raisedAt: new Date('2026-01-01T00:00:01Z'),
      }),
      buildDisputeReviewItem({
        chainDeliveryId: 9n,
        raisedBy: 'GRAISER1',
        raisedAt: new Date('2026-01-01T00:00:02Z'),
      }),
      buildDisputeReviewItem({ chainDeliveryId: 10n, raisedBy: 'GRAISER2', raisedAt: base }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const page1 = await listOpenDisputes({
      limit: 1,
      raisedBy: 'GRAISER1',
      raisedAfter: base,
    });
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listOpenDisputes({
      limit: 1,
      after: page1.nextCursor!,
      raisedBy: 'GRAISER1',
      raisedAfter: base,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await listOpenDisputes({
      limit: 1,
      after: page2.nextCursor!,
      raisedBy: 'GRAISER1',
      raisedAfter: base,
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    const ids = [...page1.items, ...page2.items, ...page3.items].map((i) => i.chainDeliveryId);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual([7n, 8n, 9n]);
  });

  it('returns an empty page when no dispute matches the filters', async () => {
    const disputeReviewReader = createFakeDisputeReviewReader();
    disputeReviewReader.seed([
      buildDisputeReviewItem({ chainDeliveryId: 7n, raisedBy: 'GRAISER1' }),
    ]);
    const listOpenDisputes = createListOpenDisputesUseCase({ disputeReviewReader });

    const result = await listOpenDisputes({ raisedBy: 'GRAISER2' });

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});
