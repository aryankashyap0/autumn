import { DrizzleCli } from "@/db/initDrizzle.js";
import { sendSvixEvent } from "@/external/svix/svixHelpers.js";
import { EntityService } from "@/internal/api/entities/EntityService.js";
import { getSingleEntityResponse } from "@/internal/api/entities/getEntityUtils.js";
import { getV2CheckResponse } from "@/internal/api/entitled/checkUtils/getV2CheckResponse.js";
import { getCustomerDetails } from "@/internal/customers/cusUtils/getCustomerDetails.js";
import { toAPIFeature } from "@/internal/features/utils/mapFeatureUtils.js";
import { AutoTopUpService } from "@/internal/autoTopUp/AutoTopUpService.js";
import {
  FullCusEntWithFullCusProduct,
  Feature,
  FullCustomer,
  Organization,
  AppEnv,
  FullCusProduct,
  APIVersion,
  WebhookEventType,
} from "@autumn/shared";

export const mergeNewCusEntsIntoCusProducts = ({
  cusProducts,
  newCusEnts,
}: {
  cusProducts: FullCusProduct[];
  newCusEnts: FullCusEntWithFullCusProduct[];
}) => {
  for (const cusProduct of cusProducts) {
    for (let i = 0; i < cusProduct.customer_entitlements.length; i++) {
      let correspondingCusEnt = newCusEnts.find(
        (cusEnt) => cusEnt.id == cusProduct.customer_entitlements[i].id
      );

      if (correspondingCusEnt) {
        const { customer_product, ...rest } = correspondingCusEnt;
        cusProduct.customer_entitlements[i] = rest;
      }
    }
  }

  return cusProducts;
};

export const sendSvixThresholdReachedEvent = async ({
  db,
  org,
  env,
  features,
  logger,
  feature,
  fullCus,
  thresholdType,
}: {
  db: DrizzleCli;
  org: Organization;
  env: AppEnv;
  features: Feature[];
  logger: any;
  feature: Feature;
  fullCus: FullCustomer;
  thresholdType: "limit_reached" | "allowance_used";
}) => {
  const cusDetails = await getCustomerDetails({
    db,
    customer: fullCus,
    org,
    env,
    features,
    logger,
    cusProducts: fullCus.customer_products,
    expand: [],
  });

  if (fullCus.entity) {
    await getSingleEntityResponse({
      org,
      env,
      features,
      fullCus,
      entity: fullCus.entity,
      entityId: fullCus.entity.id,
    });
  }

  await sendSvixEvent({
    org: org,
    env: env,
    eventType: WebhookEventType.CustomerThresholdReached,
    data: {
      threshold_type: thresholdType,
      customer: cusDetails,
      feature: toAPIFeature({ feature }),
    },
  });

  logger.info(`Sent Svix event for threshold reached (type: ${thresholdType})`);
  return;
};

export const handleAllowanceUsed = async ({
  db,
  org,
  env,
  features,
  logger,
  cusEnts,
  newCusEnts,
  feature,
  fullCus,
}: {
  db: DrizzleCli;
  org: Organization;
  env: AppEnv;
  cusEnts: FullCusEntWithFullCusProduct[];
  newCusEnts: FullCusEntWithFullCusProduct[];
  feature: Feature;
  fullCus: FullCustomer;
  features: Feature[];
  logger: any;
}) => {
  // Allowance used...
  // Make sure overage allowed is false
  const oldCusEnts = structuredClone(cusEnts);
  for (const cusEnt of oldCusEnts) {
    cusEnt.usage_allowed = false;
  }

  const clonedNewCusEnts = structuredClone(newCusEnts);
  for (const cusEnt of clonedNewCusEnts) {
    cusEnt.usage_allowed = false;
  }

  const prevCheckResponse = await getV2CheckResponse({
    fullCus,
    cusEnts: oldCusEnts,
    creditSystems: [],
    feature,
    org,
    cusProducts: fullCus.customer_products,
    apiVersion: APIVersion.v1_2,
  });

  const v2CheckResponse = await getV2CheckResponse({
    fullCus,
    cusEnts: clonedNewCusEnts,
    creditSystems: [],
    feature,
    org,
    cusProducts: fullCus.customer_products,
    apiVersion: APIVersion.v1_2,
  });

  // console.log(`Handling allowance used for feature: ${feature.id}`);
  // console.log(
  //   `Prev: allowed (${prevCheckResponse.allowed}), balance (${prevCheckResponse.balance})`
  // );
  // console.log(
  //   `Current: allowed (${v2CheckResponse.allowed}), balance (${v2CheckResponse.balance})`
  // );

  if (prevCheckResponse.allowed === true && v2CheckResponse.allowed === false) {
    await sendSvixThresholdReachedEvent({
      db,
      org,
      env,
      features,
      logger,
      feature,
      fullCus,
      thresholdType: "allowance_used",
    });
  }
};

export const handleThresholdReached = async ({
  db,
  feature,
  cusEnts,
  newCusEnts,
  fullCus,
  org,
  env,
  features,
  logger,
}: {
  db: DrizzleCli;
  feature: Feature;
  cusEnts: FullCusEntWithFullCusProduct[];
  newCusEnts: FullCusEntWithFullCusProduct[];

  fullCus: FullCustomer;
  org: Organization;
  env: AppEnv;
  features: Feature[];
  logger: any;
}) => {
  try {
    const newCusProducts = mergeNewCusEntsIntoCusProducts({
      cusProducts: fullCus.customer_products,
      newCusEnts: newCusEnts,
    });

    fullCus.customer_products = newCusProducts;

    const prevCheckResponse = await getV2CheckResponse({
      fullCus,
      cusEnts: cusEnts,
      creditSystems: [],
      feature,
      org,
      cusProducts: fullCus.customer_products,
      apiVersion: APIVersion.v1_2,
    });

    const v2CheckResponse = await getV2CheckResponse({
      fullCus,
      cusEnts: newCusEnts,
      creditSystems: [],
      feature,
      org,
      cusProducts: newCusProducts,
      apiVersion: APIVersion.v1_2,
    });

    if (
      prevCheckResponse.allowed === true &&
      v2CheckResponse.allowed === false
    ) {
      const cusDetails = await getCustomerDetails({
        db,
        customer: fullCus,
        org,
        env,
        features,
        logger,
        cusProducts: newCusProducts,
        expand: [],
      });

      if (fullCus.entity) {
        await getSingleEntityResponse({
          org,
          env,
          features,
          entity: fullCus.entity,
          fullCus,
          entityId: fullCus.entity.id,
        });
      }

      await sendSvixEvent({
        org: org,
        env: env,
        eventType: WebhookEventType.CustomerThresholdReached,
        data: {
          threshold_type: "limit_reached",
          customer: cusDetails,
          feature: toAPIFeature({ feature }),
        },
      });

      logger.info(
        "Sent Svix event for threshold reached (type: limit_reached)"
      );

      // Check for auto top-up eligibility
      await checkAndProcessAutoTopUp({
        db,
        fullCus,
        org,
        env,
        logger,
      });

      return;
    }
    await handleAllowanceUsed({
      db,
      org,
      env,
      features,
      logger,
      cusEnts,
      newCusEnts,
      feature,
      fullCus,
    });
    return;
  } catch (error: any) {
    logger.error("Failed to handle threshold reached", {
      error,
      message: error?.message,
    });
  }
};

/**
 * Check and process auto top-up for customer
 */
const checkAndProcessAutoTopUp = async ({
  db,
  fullCus,
  org,
  env,
  logger,
}: {
  db: DrizzleCli;
  fullCus: FullCustomer;
  org: Organization;
  env: AppEnv;
  logger: any;
}) => {
  try {
    // Find auto top-up products for this customer
    const autoTopUpProducts = fullCus.customer_products.filter(
      (cp) => cp.product.auto_top_up?.enabled
    );

    if (autoTopUpProducts.length === 0) {
      logger.info(`No auto top-up products found for customer ${fullCus.id}`);
      return;
    }

    // Process auto top-up for each product
    for (const product of autoTopUpProducts) {
      const result = await AutoTopUpService.processAutoTopUp({
        db,
        customerId: fullCus.id,
        productId: product.product_id,
        org,
        env: env as string,
        logger,
      });

      if (result.success) {
        logger.info(
          `Auto top-up successful for customer ${fullCus.id}, product ${product.product_id}`
        );
      } else {
        logger.warn(
          `Auto top-up failed for customer ${fullCus.id}, product ${product.product_id}: ${result.error}`
        );
      }
    }
  } catch (error: any) {
    logger.error("Failed to check auto top-up", {
      error: error.message,
      customerId: fullCus.id,
    });
  }
};
