import type { PrismaClient } from '@prisma/client';
import type { DisputeReviewReader } from '../domain/index.js';

export function createPrismaDisputeReviewReader(prisma: PrismaClient): DisputeReviewReader {
  return {
    async listOpenDisputes(filter) {
      const where: Record<string, unknown> = {
        status: 'OPEN',
      };
      if (filter.raisedBy) where.raisedBy = filter.raisedBy;
      if (filter.raisedAfter || filter.raisedBefore) {
        where.raisedAt = {
          ...(filter.raisedAfter && { gte: filter.raisedAfter }),
          ...(filter.raisedBefore && { lt: filter.raisedBefore }),
        };
      }

      const disputes = await prisma.dispute.findMany({
        where,
        ...(filter.after && {
          OR: [
            { raisedAt: { gt: filter.after.raisedAt } },
            {
              raisedAt: filter.after.raisedAt,
              chainDeliveryId: { gt: filter.after.chainDeliveryId },
            },
          ],
        }),
        orderBy: [{ raisedAt: 'asc' }, { chainDeliveryId: 'asc' }],
        take: filter.limit + 1,
        include: { _count: { select: { evidence: true } } },
      });
      return disputes.map((dispute) => ({
        chainDeliveryId: dispute.chainDeliveryId,
        status: dispute.status,
        raisedBy: dispute.raisedBy,
        raisedAt: dispute.raisedAt,
        evidenceCount: dispute._count.evidence,
      }));
    },
  };
}
