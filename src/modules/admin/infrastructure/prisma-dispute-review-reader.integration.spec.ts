import { PrismaClient } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaDisputeReviewReader } from './prisma-dispute-review-reader.js';
import { isDatabaseAvailable } from '../../../shared/testing/database.js';

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)('Prisma dispute review reader (integration)', () => {
  const prisma = new PrismaClient();
  const disputeReviewReader = createPrismaDisputeReviewReader(prisma);
  const createdChainIds: bigint[] = [];

  afterAll(async () => {
    if (createdChainIds.length > 0) {
      await prisma.evidence.deleteMany({
        where: { dispute: { chainDeliveryId: { in: createdChainIds } } },
      });
      await prisma.dispute.deleteMany({ where: { chainDeliveryId: { in: createdChainIds } } });
      await prisma.delivery.deleteMany({ where: { chainDeliveryId: { in: createdChainIds } } });
    }
    await prisma.$disconnect();
  });

  function nextChainId(): bigint {
    const id = BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000));
    createdChainIds.push(id);
    return id;
  }

  async function seedDelivery(): Promise<bigint> {
    const chainDeliveryId = nextChainId();
    await prisma.delivery.create({
      data: {
        chainDeliveryId,
        senderAddress: Keypair.random().publicKey(),
        recipientAddress: Keypair.random().publicKey(),
        status: 'DISPUTED',
        origin: 'Lagos',
        destination: 'Accra',
        cargoCategory: 'GENERAL',
        weightGrams: 500,
        fragile: false,
        createdAtChain: new Date(),
      },
    });
    return chainDeliveryId;
  }

  it('lists only OPEN disputes, with an evidence count, ordered oldest-raised-first', async () => {
    const openOlder = await seedDelivery();
    const openNewer = await seedDelivery();
    const resolved = await seedDelivery();

    await prisma.dispute.create({
      data: {
        chainDeliveryId: openOlder,
        status: 'OPEN',
        raisedBy: 'GRAISER1',
        raisedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const disputeWithEvidence = await prisma.dispute.create({
      data: {
        chainDeliveryId: openNewer,
        status: 'OPEN',
        raisedBy: 'GRAISER2',
        raisedAt: new Date('2026-01-02T00:00:00Z'),
      },
    });
    await prisma.evidence.create({
      data: {
        disputeId: disputeWithEvidence.id,
        hash: 'a'.repeat(64),
        storageUrl: 'ignored/for-this-test',
        contentType: 'text/plain',
        uploadedBy: 'GRAISER2',
      },
    });
    await prisma.dispute.create({
      data: {
        chainDeliveryId: resolved,
        status: 'RESOLVED_REFUND',
        raisedBy: 'GRAISER3',
        raisedAt: new Date(),
        resolvedBy: 'GADMIN',
        resolvedAt: new Date(),
      },
    });

    const results = await disputeReviewReader.listOpenDisputes({ limit: 100 });
    const relevant = results.filter((r) => createdChainIds.includes(r.chainDeliveryId));

    expect(relevant).toEqual([
      {
        chainDeliveryId: openOlder,
        status: 'OPEN',
        raisedBy: 'GRAISER1',
        raisedAt: new Date('2026-01-01T00:00:00Z'),
        evidenceCount: 0,
      },
      {
        chainDeliveryId: openNewer,
        status: 'OPEN',
        raisedBy: 'GRAISER2',
        raisedAt: new Date('2026-01-02T00:00:00Z'),
        evidenceCount: 1,
      },
    ]);
  });

  it('paginates disputes with matching timestamps using the chain delivery id tie-breaker', async () => {
    const first = await seedDelivery();
    const second = await seedDelivery();
    const third = await seedDelivery();
    const raisedAt = new Date('2099-02-01T00:00:00Z');

    for (const [chainDeliveryId, raisedBy] of [
      [first, 'GRAISER1'],
      [second, 'GRAISER2'],
      [third, 'GRAISER3'],
    ] as const) {
      await prisma.dispute.create({
        data: { chainDeliveryId, status: 'OPEN', raisedBy, raisedAt },
      });
    }

    const results = await disputeReviewReader.listOpenDisputes({
      limit: 1,
      after: { raisedAt, chainDeliveryId: first },
    });

    expect(results.map((result) => result.chainDeliveryId)).toEqual([second, third]);
  });

  it('filters open disputes by raisedBy', async () => {
    const graiserOne = await seedDelivery();
    const graiserTwo = await seedDelivery();
    const graiserThree = await seedDelivery();

    await prisma.dispute.create({
      data: { chainDeliveryId: graiserOne, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.dispute.create({
      data: { chainDeliveryId: graiserTwo, status: 'OPEN', raisedBy: 'GRAISER-B', raisedAt: new Date('2026-01-02T00:00:00Z') },
    });
    await prisma.dispute.create({
      data: { chainDeliveryId: graiserThree, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt: new Date('2026-01-03T00:00:00Z') },
    });

    const results = await disputeReviewReader.listOpenDisputes({
      limit: 100,
      raisedBy: 'GRAISER-A',
    });

    const relevant = results.filter((r) => createdChainIds.includes(r.chainDeliveryId));
    expect(relevant).toHaveLength(2);
    expect(relevant.every((r) => r.raisedBy === 'GRAISER-A')).toBe(true);
  });

  it('filters open disputes by raisedAfter inclusive and raisedBefore exclusive', async () => {
    const earlier = await seedDelivery();
    const middle = await seedDelivery();
    const later = await seedDelivery();

    const raisedAt = new Date('2026-06-01T00:00:00Z');
    const oneDay = 24 * 60 * 60 * 1000;
    await prisma.dispute.create({
      data: { chainDeliveryId: earlier, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt: new Date(raisedAt.getTime() - oneDay) },
    });
    await prisma.dispute.create({
      data: { chainDeliveryId: middle, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt: raisedAt },
    });
    await prisma.dispute.create({
      data: { chainDeliveryId: later, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt: new Date(raisedAt.getTime() + oneDay) },
    });

    const results = await disputeReviewReader.listOpenDisputes({
      limit: 100,
      raisedAfter: raisedAt,
      raisedBefore: new Date(raisedAt.getTime() + oneDay),
    });

    const relevant = results.filter((r) => createdChainIds.includes(r.chainDeliveryId));
    expect(relevant).toHaveLength(1);
    expect(relevant[0]!.chainDeliveryId).toBe(middle);
  });

  it('applies raisedBy and time filters together with cursor pagination', async () => {
    const ids: bigint[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push(await seedDelivery());
    }
    const raisedAt = new Date('2026-01-01T00:00:00Z');
    for (const chainDeliveryId of ids) {
      await prisma.dispute.create({
        data: { chainDeliveryId, status: 'OPEN', raisedBy: 'GRAISER-A', raisedAt },
      });
    }

    const page1 = await disputeReviewReader.listOpenDisputes({
      limit: 1,
      raisedBy: 'GRAISER-A',
      raisedAfter: raisedAt,
    });
    expect(page1).toHaveLength(1);
    expect(page1[0]!.chainDeliveryId).toBe(ids[0]);

    const page2 = await disputeReviewReader.listOpenDisputes({
      limit: 1,
      after: { raisedAt, chainDeliveryId: ids[0] },
      raisedBy: 'GRAISER-A',
      raisedAfter: raisedAt,
    });
    expect(page2).toHaveLength(1);
    expect(page2[0]!.chainDeliveryId).toBe(ids[1]);

    const page3 = await disputeReviewReader.listOpenDisputes({
      limit: 1,
      after: { raisedAt, chainDeliveryId: ids[1] },
      raisedBy: 'GRAISER-A',
      raisedAfter: raisedAt,
    });
    expect(page3).toHaveLength(1);
    expect(page3[0]!.chainDeliveryId).toBe(ids[2]);
  });
});
