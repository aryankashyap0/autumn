import { useCusQuery } from "../../hooks/useCusQuery";
import { FeatureType } from "@autumn/shared";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertCircle, CheckCircle, Clock } from "lucide-react";

export const CustomerCreditBalance = () => {
  const { customer } = useCusQuery();
  const [totalCredits, setTotalCredits] = useState(0);
  const [autoTopUpInfo, setAutoTopUpInfo] = useState<any>(null);

  // Calculate total credit balance across all products
  useEffect(() => {
    let total = 0;
    let autoTopUp = null;

    customer.customer_products.forEach((cp) => {
      cp.customer_entitlements.forEach((ce) => {
        if (ce.entitlement.feature.type === FeatureType.CreditSystem) {
          total += ce.balance || 0;
        }
      });

      // Check if this product has auto top-up enabled
      if ((cp.product as any).auto_top_up?.enabled) {
        autoTopUp = {
          productName: cp.product.name,
          threshold: (cp.product as any).auto_top_up.threshold,
          topUpAmount: (cp.product as any).auto_top_up.topUpAmount,
          maxPerMonth: (cp.product as any).auto_top_up.maxTopUpsPerMonth,
        };
      }
    });

    setTotalCredits(total);
    setAutoTopUpInfo(autoTopUp);
  }, [customer]);

  const getCreditStatus = () => {
    if (!autoTopUpInfo) return { status: "none", message: "No auto top-up configured" };
    
    if (totalCredits <= autoTopUpInfo.threshold) {
      return { 
        status: "low", 
        message: `Low balance! Auto top-up will trigger at ${autoTopUpInfo.threshold} credits` 
      };
    }
    
    return { 
      status: "good", 
      message: `Balance above threshold (${autoTopUpInfo.threshold} credits)` 
    };
  };

  const status = getCreditStatus();

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CreditCard size={16} />
          Credit Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{totalCredits.toLocaleString()}</span>
          <span className="text-sm text-gray-500">credits</span>
        </div>

        {autoTopUpInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {status.status === "low" ? (
                <AlertCircle size={14} className="text-orange-500" />
              ) : status.status === "good" ? (
                <CheckCircle size={14} className="text-green-500" />
              ) : (
                <Clock size={14} className="text-gray-500" />
              )}
              <span className="text-xs text-gray-600">{status.message}</span>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <div>Auto top-up: {autoTopUpInfo.topUpAmount.toLocaleString()} credits</div>
              <div>Max per month: {autoTopUpInfo.maxPerMonth}</div>
            </div>

            {status.status === "low" && (
              <Badge variant="outline" className="text-orange-600 border-orange-200">
                Auto top-up pending
              </Badge>
            )}
          </div>
        )}

        {!autoTopUpInfo && (
          <div className="text-xs text-gray-500">
            No auto top-up configured for this customer
          </div>
        )}
      </CardContent>
    </Card>
  );
};

