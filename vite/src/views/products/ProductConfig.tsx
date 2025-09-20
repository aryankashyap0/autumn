import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import FieldLabel from "@/components/general/modal-components/FieldLabel";
// import { Product } from "@autumn/shared";
import { useState } from "react";
import { slugify } from "@/utils/formatUtils/formatTextUtils";
import { Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ProductConfig = ({
  product,
  setProduct,
  isUpdate = false,
}: {
  product: any;
  setProduct: (product: any) => void;
  isUpdate?: boolean;
}) => {
  const [idEdit, setIdEdit] = useState(false);
  const [showAutoTopUp, setShowAutoTopUp] = useState(false);

  // Initialize auto top-up config if it doesn't exist
  const autoTopUpConfig = product.auto_top_up || {
    enabled: false,
    threshold: 100,
    topUpAmount: 1000,
    priceId: "",
    maxTopUpsPerMonth: 10,
  };

  const updateAutoTopUpConfig = (updates: any) => {
    const newConfig = {
      ...autoTopUpConfig,
      ...updates,
    };
    
    // If auto top up is disabled, set to null to match database schema
    setProduct({
      ...product,
      auto_top_up: newConfig.enabled ? newConfig : null,
    });
  };

  return (
    <>
      <div className="flex w-full gap-2">
        <div className="w-full">
          <FieldLabel>Name</FieldLabel>
          <Input
            placeholder="eg. Starter Product"
            value={product.name}
            onChange={(e) => {
              const newFields = { ...product, name: e.target.value };
              if (!idEdit && !isUpdate) {
                newFields.id = slugify(e.target.value);
              }
              setProduct(newFields);
            }}
          />
        </div>
        <div className="w-full">
          <FieldLabel>ID</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              autoFocus={idEdit}
              placeholder="eg. Product ID"
              disabled={!idEdit}
              className="disabled:bg-transparent disabled:border-none disabled:shadow-none"
              value={product.id}
              onChange={(e) => {
                setProduct({ ...product, id: e.target.value });
              }}
            />
            <Pencil
              size={12}
              className="text-t3 cursor-pointer w-8 h-8 px-2 hover:text-[#8231FF]"
              onClick={() => setIdEdit(true)}
            />
          </div>
        </div>
      </div>

      {/* Auto Top-Up Configuration */}
      <div className="mt-6 border-t pt-4">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="auto-top-up-enabled"
            checked={autoTopUpConfig.enabled || false}
            onCheckedChange={(checked) =>
              updateAutoTopUpConfig({ enabled: checked === true })
            }
          />
          <div>
            <label
              htmlFor="auto-top-up-enabled"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enable Auto Top-Up
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Allow customers to configure automatic credit top-ups when their balance gets low
            </p>
          </div>
        </div>

        {autoTopUpConfig.enabled && (
          <div className="space-y-4 ml-6 pl-4 border-l-2 border-gray-100">
            <div>
              <FieldLabel>Default Threshold (Credits)</FieldLabel>
              <Input
                type="number"
                placeholder="100"
                value={autoTopUpConfig.threshold || 100}
                onChange={(e) =>
                  updateAutoTopUpConfig({ threshold: parseInt(e.target.value) || 100 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Default threshold when customer's total balance should trigger auto top-up (customers can override this)
              </p>
            </div>

            <div>
              <FieldLabel>Default Top-Up Amount (Credits)</FieldLabel>
              <Input
                type="number"
                placeholder="1000"
                value={autoTopUpConfig.topUpAmount || 1000}
                onChange={(e) =>
                  updateAutoTopUpConfig({ topUpAmount: parseInt(e.target.value) || 1000 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Default number of credits to add when auto top-up is triggered (customers can override this)
              </p>
            </div>

            <div>
              <FieldLabel>Stripe Price ID</FieldLabel>
              <Input
                type="text"
                placeholder="price_1234567890"
                value={autoTopUpConfig.priceId || ""}
                onChange={(e) =>
                  updateAutoTopUpConfig({ priceId: e.target.value })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Stripe price ID to charge customers for auto top-ups
              </p>
            </div>

            <div>
              <FieldLabel>Max Top-Ups per Month</FieldLabel>
              <Input
                type="number"
                placeholder="10"
                value={autoTopUpConfig.maxTopUpsPerMonth || 10}
                onChange={(e) =>
                  updateAutoTopUpConfig({ maxTopUpsPerMonth: parseInt(e.target.value) || 10 })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum number of auto top-ups allowed per customer per month (prevents excessive charges)
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
