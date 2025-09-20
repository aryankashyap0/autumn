import RecaseError from "@/utils/errorUtils.js";
import { CusService } from "@/internal/customers/CusService.js";
import { routeHandler } from "@/utils/routerUtils.js";
import { ErrCode, autoTopUpHistory } from "@autumn/shared";
import { StatusCodes } from "http-status-codes";
import { ExtendedResponse, ExtendedRequest } from "@/utils/models/Request.js";
import { desc, eq, and } from "drizzle-orm";

export const handleGetAutoTopUpHistory = async (req: any, res: any) =>
  routeHandler({
    req,
    res,
    action: "GET/customers/:customer_id/auto-top-up-history",
    handler: async (req: ExtendedRequest, res: ExtendedResponse) => {
      const { orgId, env, db } = req;
      const customerId = req.params.customer_id;
      
      // Get customer to verify it exists
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

      // Fetch auto top-up history for this customer
      const history = await db
        .select()
        .from(autoTopUpHistory)
        .where(eq(autoTopUpHistory.customer_id, customerId))
        .orderBy(desc(autoTopUpHistory.created_at))
        .limit(50); // Limit to last 50 records

      res.status(200).json({
        success: true,
        history: history,
      });
    },
  });
