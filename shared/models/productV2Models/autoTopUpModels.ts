import { z } from "zod";

export const AutoTopUpConfigSchema = z.object({
  enabled: z.boolean().default(false),
  threshold: z.number().min(0).optional(), // Minimum credit balance to trigger auto top-up
  topUpAmount: z.number().min(1).optional(), // Amount of credits to add when triggered
  priceId: z.string().optional(), // Stripe price ID for charging
  maxTopUpsPerMonth: z.number().min(1).default(10).optional(), // Prevent abuse
});

export const CustomerAutoTopUpConfigSchema = z.object({
  customerId: z.string(),
  productId: z.string(),
  threshold: z.number().min(0).optional(), // Override default threshold
  enabled: z.boolean().default(true), // Allow disabling per customer
});

export const AutoTopUpHistorySchema = z.object({
  id: z.string(),
  customerId: z.string(),
  productId: z.string(),
  threshold: z.number(),
  topUpAmount: z.number(),
  chargedAmount: z.number(),
  stripeInvoiceId: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  errorMessage: z.string().optional(),
});

export type AutoTopUpConfig = z.infer<typeof AutoTopUpConfigSchema>;
export type CustomerAutoTopUpConfig = z.infer<typeof CustomerAutoTopUpConfigSchema>;
export type AutoTopUpHistory = z.infer<typeof AutoTopUpHistorySchema>;
