import UpdateCustomerDialog from "../UpdateCustomerDialog";
import { useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Dialog } from "@/components/ui/dialog";
import { CustomerRewards } from "./customer-rewards";
import { CustomerToolbar } from "../../CustomerToolbar";
import { CustomerDetails } from "./CustomerDetails";
import { CustomerEntities } from "./CustomerEntities";
import { CustomerCreditBalance } from "./CustomerCreditBalance";
import { CustomerAutoTopUpConfig } from "./CustomerAutoTopUpConfig";
import { AutoTopUpHistory } from "../AutoTopUpHistory";
import { useCusQuery } from "../../hooks/useCusQuery";

export const CustomerSidebar = () => {
  const { customer } = useCusQuery();
  const entities = customer.entities;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("coupon");

  return (
    <div className="flex flex-col h-full border-l text-t2 overflow-hidden min-w-[280px] w-full">
      {/* Fixed header section */}
      <div className="flex-shrink-0 flex w-full justify-end px-4 py-2 border-b">
        <CustomerToolbar customer={customer} />
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <UpdateCustomerDialog
          selectedCustomer={customer}
          open={isModalOpen}
          setOpen={setIsModalOpen}
        />
      </Dialog>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 pt-4 pb-2 space-y-4">
          <CustomerCreditBalance />
          <CustomerAutoTopUpConfig />
          <AutoTopUpHistory />
        </div>
        
        <Accordion
          type="multiple"
          className="w-full flex flex-col"
          defaultValue={["details", "rewards", "entities"]}
        >
          <CustomerDetails
            setIsModalOpen={setIsModalOpen}
            setModalType={setModalType}
          />
          <CustomerRewards />
          {entities.length > 0 && <CustomerEntities />}
        </Accordion>
      </div>
    </div>
  );
};
