import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import FieldLabel from "@/components/general/modal-components/FieldLabel";
import { CreditCard, Settings, Save, AlertCircle } from "lucide-react";
import { useCusQuery } from "../../hooks/useCusQuery";
import { toast } from "sonner";
import { useAxiosInstance } from "@/services/useAxiosInstance";
import { useEnv } from "@/utils/envUtils";

interface CustomerAutoTopUpConfig {
  enabled: boolean;
  threshold: number;
  topUpAmount: number;
  maxTopUpsPerMonth: number;
}

export const CustomerAutoTopUpConfig = () => {
  const { customer } = useCusQuery();
  const env = useEnv();
  const axiosInstance = useAxiosInstance({ env });
  
  const [config, setConfig] = useState<CustomerAutoTopUpConfig>({
    enabled: false,
    threshold: 100,
    topUpAmount: 1000,
    maxTopUpsPerMonth: 10,
  });
  const [loading, setLoading] = useState(false);
  const [hasAutoTopUpProduct, setHasAutoTopUpProduct] = useState(false);

  // Check if customer has any products with auto top-up enabled
  useEffect(() => {
    const hasAutoTopUp = customer.customer_products.some(
      (cp) => (cp.product as any).auto_top_up?.enabled
    );
    setHasAutoTopUpProduct(hasAutoTopUp);
    
    // Load existing config from customer data
    if (customer.auto_top_up_config) {
      setConfig(customer.auto_top_up_config);
    }
  }, [customer]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await axiosInstance.post(`/v1/customers/${customer.id}/auto-top-up-config`, config);
      
      toast.success("Auto top-up configuration saved!");
    } catch (error: any) {
      console.error("Failed to save auto top-up config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  if (!hasAutoTopUpProduct) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard size={16} />
            Auto Top-Up Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No auto top-up products available</p>
            <p className="text-xs">Contact your provider to enable auto top-ups</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings size={16} />
          Auto Top-Up Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="customer-auto-top-up-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) =>
              setConfig({ ...config, enabled: checked as boolean })
            }
          />
          <label
            htmlFor="customer-auto-top-up-enabled"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Enable Auto Top-Up
          </label>
        </div>

        {config.enabled && (
          <div className="space-y-4 ml-6">
            <div>
              <FieldLabel>Threshold (Credits)</FieldLabel>
              <Input
                type="number"
                placeholder="100"
                value={config.threshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    threshold: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Trigger when your balance falls below this amount
              </p>
            </div>

            <div>
              <FieldLabel>Top-Up Amount (Credits)</FieldLabel>
              <Input
                type="number"
                placeholder="1000"
                value={config.topUpAmount}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    topUpAmount: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Credits to add when triggered
              </p>
            </div>

            <div>
              <FieldLabel>Max Top-Ups per Month</FieldLabel>
              <Input
                type="number"
                placeholder="10"
                value={config.maxTopUpsPerMonth}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxTopUpsPerMonth: parseInt(e.target.value) || 1,
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Prevent excessive charges with monthly limits
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              <Save size={14} className="mr-2" />
              {loading ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
