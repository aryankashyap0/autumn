import RecaseError from "@/utils/errorUtils.js";
import { CusService } from "@/internal/customers/CusService.js";
import { routeHandler } from "@/utils/routerUtils.js";
import { ErrCode } from "@autumn/shared";
import { StatusCodes } from "http-status-codes";
import { ExtendedResponse, ExtendedRequest } from "@/utils/models/Request.js";
import { z } from "zod";

const AutoTopUpConfigSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().min(0),
  topUpAmount: z.number().min(1),
  maxTopUpsPerMonth: z.number().min(1).max(100),
});

export const handleUpdateAutoTopUpConfig = async (req: any, res: any) =>
  routeHandler({
    req,
    res,
    action: "POST/customers/:customer_id/auto-top-up-config",
    handler: async (req: ExtendedRequest, res: ExtendedResponse) => {
      const { orgId, env, db } = req;
      const customerId = req.params.customer_id;
      
      // Validate request body
      const config = AutoTopUpConfigSchema.parse(req.body);
      
      // Get customer
      const customer = await CusService.get({
        db,
        idOrInternalId: customerId,
        orgId,
        env,
      });

      if (!customer) {
        throw new RecaseError({
          message: `Customer ${customerId} not found`,
          code: ErrCode.CustomerNotFound,
          statusCode: StatusCodes.NOT_FOUND,
        });
      }

      // Update customer with auto top-up config
      const updatedCustomer = await CusService.update({
        db,
        internalCusId: customer.internal_id,
        update: {
          auto_top_up_config: config,
        },
      });

      res.status(200).json({
        success: true,
        config: config,
      });
    },
  });
