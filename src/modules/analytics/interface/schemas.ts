import { z } from 'zod';

export const gmvResponseSchema = z.object({
  data: z.array(
    z.object({
      token: z.string(),
      releasedAmount: z.string().max(100),
      releasedCount: z.number().int(),
    }),
  ),
});

export const gmvQuerySchema = z
  .object({
    /** Inclusive lower bound on the escrow release timestamp (UTC ISO-8601). */
    from: z.string().datetime().optional(),
    /** Exclusive upper bound on the escrow release timestamp (UTC ISO-8601). */
    to: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from).getTime() < new Date(data.to).getTime();
      }
      return true;
    },
    { message: 'from must be before to', path: ['to'] },
  );

export const completionRateResponseSchema = z.object({
  data: z.object({
    totalDeliveries: z.number().int(),
    deliveredCount: z.number().int(),
    completionRate: z.number(),
  }),
});

export const disputeRateResponseSchema = z.object({
  data: z.object({
    totalDeliveries: z.number().int(),
    disputedCount: z.number().int(),
    disputeRate: z.number(),
  }),
});

export const driverTierDistributionResponseSchema = z.object({
  data: z.object({
    bronze: z.number().int(),
    silver: z.number().int(),
    gold: z.number().int(),
    total: z.number().int(),
  }),
});
