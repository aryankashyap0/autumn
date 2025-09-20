import { DrizzleCli } from "@/db/initDrizzle.js";
import { FullCustomer, Feature, Organization, CusProductStatus, autoTopUpHistory } from "@autumn/shared";
import { Decimal } from "decimal.js";
import { getCusBalances } from "../customers/cusUtils/cusFeatureResponseUtils/getCusBalances.js";
import { CusService } from "../customers/CusService.js";
import { createStripeCli } from "@/external/stripe/utils.js";
import { CusEntService } from "../customers/cusProducts/cusEnts/CusEntitlementService.js";
import { generateId } from "@/utils/genUtils.js";
import { eq, and, gte, sql } from "drizzle-orm";
import Stripe from "stripe";

/**
 * Create a Stripe invoice for auto top-up
 */
const createStripeInvoice = async ({
  stripeCli,
  customerId,
  priceId,
}: {
  stripeCli: Stripe;
  customerId: string;
  priceId: string;
}): Promise<{
  success: boolean;
  invoiceId?: string;
  amount?: number;
  error?: string;
}> => {
  try {
    // Create invoice
    const invoice = await stripeCli.invoices.create({
      customer: customerId,
      auto_advance: true,
    });

    // Add invoice item using the provided price ID
    await stripeCli.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      price_data: {
        currency: 'usd',
        product: priceId, // For now, treat priceId as product ID - should be updated to use actual Stripe price
        unit_amount: 1000, // This should be derived from the actual price configuration
      },
    });

    // Finalize and pay invoice
    const finalizedInvoice = await stripeCli.invoices.finalizeInvoice(invoice.id!);
    
    if (finalizedInvoice.status === "open") {
      const paidInvoice = await stripeCli.invoices.pay(finalizedInvoice.id!);
      
      return {
        success: true,
        invoiceId: paidInvoice.id!,
        amount: paidInvoice.total,
      };
    }

    return {
      success: true,
      invoiceId: finalizedInvoice.id!,
      amount: finalizedInvoice.total,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export class AutoTopUpService {
  /**
   * Check if a customer is eligible for auto top-up
   */
  static async checkEligibility({
    db,
    customerId,
    productId,
    org,
    env,
  }: {
    db: DrizzleCli;
    customerId: string;
    productId: string;
    org: Organization;
    env: string;
  }): Promise<{
    eligible: boolean;
    totalBalance: number;
    threshold: number;
    topUpAmount: number;
    reason?: string;
  }> {
    // Get customer with all products
    const customer = await CusService.getFull({
      db,
      idOrInternalId: customerId,
      orgId: org.id,
      env: env as any,
      inStatuses: [CusProductStatus.Active, CusProductStatus.PastDue],
      withSubs: true,
    });

    if (!customer) {
      return {
        eligible: false,
        totalBalance: 0,
        threshold: 0,
        topUpAmount: 0,
        reason: "Customer not found",
      };
    }

    // Find the auto top-up product
    const autoTopUpProduct = customer.customer_products.find(
      (cp) => cp.product_id === productId
    );

    if (!autoTopUpProduct || !(autoTopUpProduct.product as any).auto_top_up?.enabled) {
      return {
        eligible: false,
        totalBalance: 0,
        threshold: 0,
        topUpAmount: 0,
        reason: "Auto top-up not enabled for this product",
      };
    }

    // Check if customer has disabled auto top-up at the customer level
    if ((customer as any).auto_top_up_config?.enabled === false) {
      return {
        eligible: false,
        totalBalance: 0,
        threshold: 0,
        topUpAmount: 0,
        reason: "Auto top-up disabled by customer",
      };
    }

    const config = (autoTopUpProduct.product as any).auto_top_up;
    
    // Use customer-specific threshold override if available, otherwise use product default
    const threshold = (customer as any).auto_top_up_config?.enabled && (customer as any).auto_top_up_config?.threshold !== undefined
      ? (customer as any).auto_top_up_config.threshold
      : config.threshold;
    
    // Use customer-specific topUpAmount override if available, otherwise use product default  
    const topUpAmount = (customer as any).auto_top_up_config?.enabled && (customer as any).auto_top_up_config?.topUpAmount !== undefined
      ? (customer as any).auto_top_up_config.topUpAmount
      : config.topUpAmount;

    // Calculate total credit balance across ALL products
    const totalBalance = await this.getTotalCreditBalance({
      db,
      customer,
      org,
      env: env as any,
    });

    // Check if balance is below threshold
    const eligible = totalBalance <= threshold;

    // Check monthly limit - use customer-specific override if available
    const monthlyTopUps = await this.getMonthlyTopUpCount({
      db,
      customerId,
      productId,
    });

    const maxTopUpsPerMonth = (customer as any).auto_top_up_config?.enabled && (customer as any).auto_top_up_config?.maxTopUpsPerMonth !== undefined
      ? (customer as any).auto_top_up_config.maxTopUpsPerMonth
      : config.maxTopUpsPerMonth;

    if (monthlyTopUps >= maxTopUpsPerMonth) {
      return {
        eligible: false,
        totalBalance,
        threshold,
        topUpAmount,
        reason: "Monthly auto top-up limit reached",
      };
    }

    return {
      eligible,
      totalBalance,
      threshold,
      topUpAmount,
      reason: eligible ? undefined : "Balance above threshold",
    };
  }

  /**
   * Process auto top-up for a customer
   */
  static async processAutoTopUp({
    db,
    customerId,
    productId,
    org,
    env,
    logger,
  }: {
    db: DrizzleCli;
    customerId: string;
    productId: string;
    org: Organization;
    env: string;
    logger: any;
  }): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      // Check eligibility
      const eligibility = await this.checkEligibility({
        db,
        customerId,
        productId,
        org,
        env,
      });

      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reason || "Not eligible for auto top-up",
        };
      }

      // Create auto top-up record
      const autoTopUpId = generateId("atu");
      const topUpRecord = {
        id: autoTopUpId,
        customer_id: customerId,
        product_id: productId,
        threshold: eligibility.threshold,
        top_up_amount: eligibility.topUpAmount,
        charged_amount: 0, // Will be updated after Stripe charge
        status: "pending" as const,
        created_at: Date.now(),
      };

      await db.insert(autoTopUpHistory).values(topUpRecord);

      // Get customer for Stripe charging
      const customer = await CusService.getFull({
        db,
        idOrInternalId: customerId,
        orgId: org.id,
        env: env as any,
        inStatuses: [CusProductStatus.Active, CusProductStatus.PastDue],
        withSubs: true,
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      // Find the auto top-up product to get price ID
      const autoTopUpProduct = customer.customer_products.find(
        (cp) => cp.product_id === productId
      );

      // Charge customer via Stripe
      const stripeCli = createStripeCli({ org, env: env as any });
      const priceId = (autoTopUpProduct!.product as any).auto_top_up?.priceId;
      
      if (!priceId) {
        throw new Error("No Stripe price ID configured for auto top-up product");
      }
      
      const stripeResult = await createStripeInvoice({
        stripeCli,
        customerId: customer.processor?.id!,
        priceId,
      });

      if (!stripeResult.success) {
        // Update record as failed
        await db
          .update(autoTopUpHistory)
          .set({
            status: "failed",
            error_message: stripeResult.error,
          })
          .where(eq(autoTopUpHistory.id, autoTopUpId));

        return {
          success: false,
          error: stripeResult.error,
        };
      }

      // Add credits to customer's balance
      await this.addCreditsToCustomer({
        db,
        customer,
        creditAmount: eligibility.topUpAmount,
        org,
        env: env as any,
      });

      // Update record as completed
      await db
        .update(autoTopUpHistory)
        .set({
          status: "completed",
          charged_amount: stripeResult.amount || 0,
          stripe_invoice_id: stripeResult.invoiceId,
          completed_at: Date.now(),
        })
        .where(eq(autoTopUpHistory.id, autoTopUpId));

      logger.info(`Auto top-up completed for customer ${customerId}: ${eligibility.topUpAmount} credits`);

      return {
        success: true,
        invoiceId: stripeResult.invoiceId,
      };
    } catch (error: any) {
      logger.error("Auto top-up failed", { error: error.message, customerId, productId });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate total credit balance across all customer products
   */
  private static async getTotalCreditBalance({
    db,
    customer,
    org,
    env,
  }: {
    db: DrizzleCli;
    customer: FullCustomer;
    org: Organization;
    env: any;
  }): Promise<number> {
    // Get all credit system features
    const creditFeatures = customer.customer_products
      .flatMap(cp => cp.customer_entitlements)
      .filter(ce => ce.entitlement.feature.type === "credit_system");

    if (creditFeatures.length === 0) {
      return 0;
    }

    // Calculate total balance across all credit systems
    let totalBalance = 0;
    for (const cusEnt of creditFeatures) {
      const balance = cusEnt.balance || 0;
      totalBalance += balance;
    }

    return totalBalance;
  }

  /**
   * Add credits to customer's balance
   */
  private static async addCreditsToCustomer({
    db,
    customer,
    creditAmount,
    org,
    env,
  }: {
    db: DrizzleCli;
    customer: FullCustomer;
    creditAmount: number;
    org: Organization;
    env: any;
  }): Promise<void> {
    // Find the main credit system entitlement
    const creditEntitlement = customer.customer_products
      .flatMap(cp => cp.customer_entitlements)
      .find(ce => ce.entitlement.feature.type === "credit_system");

    if (!creditEntitlement) {
      throw new Error("No credit system found for customer");
    }

    // Add credits to the entitlement
    const newBalance = (creditEntitlement.balance || 0) + creditAmount;
    
    await CusEntService.update({
      db,
      id: creditEntitlement.id,
      updates: {
        balance: newBalance,
      },
    });
  }

  /**
   * Get monthly top-up count for a customer
   */
  private static async getMonthlyTopUpCount({
    db,
    customerId,
    productId,
  }: {
    db: DrizzleCli;
    customerId: string;
    productId: string;
  }): Promise<number> {
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(autoTopUpHistory)
      .where(
        and(
          eq(autoTopUpHistory.customer_id, customerId),
          eq(autoTopUpHistory.product_id, productId),
          gte(autoTopUpHistory.created_at, oneMonthAgo)
        )
      );

    return result[0]?.count || 0;
  }
}
