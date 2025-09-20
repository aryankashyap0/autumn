import { SideAccordion } from "@/components/general/SideAccordion";
import { SidebarLabel } from "@/components/general/sidebar/sidebar-label";

import { Entity, Feature } from "@autumn/shared";

import { getFeatureName } from "@autumn/shared";

import CopyButton from "@/components/general/CopyButton";
import { useCusQuery } from "../../hooks/useCusQuery";
import { useCustomerContext } from "../../CustomerContext";

export const CustomerEntities = () => {
  const { customer, features } = useCusQuery();
  const { entityId } = useCustomerContext();

  const entities = customer.entities;

  const entity = entities.find(
    (entity: Entity) =>
      entity.id === entityId || entity.internal_id === entityId
  );

  const feature = features.find(
    (feature: Feature) => entity?.internal_feature_id === feature.internal_id
  );

  const featureName = getFeatureName({
    feature,
    plural: false,
    capitalize: true,
  });

  if (!entity) {
    return null;
  }

  return (
    <div className="flex w-full border-b mt-[2.5px] p-4 ">
      <SideAccordion title="Entities" value="entities">
        <div className="grid grid-cols-3 gap-y-4 gap-x-2 w-full items-center min-w-0">
          {/* <SelectEntity /> */}
          <SidebarLabel>ID</SidebarLabel>
          <div className="col-span-2 justify-end flex min-w-0">
            <div className="w-full flex justify-end min-w-0">
              {entity.id ? (
                <CopyButton text={entity?.id} className="max-w-full">
                  <span className="truncate max-w-full block">{entity?.id}</span>
                </CopyButton>
              ) : (
                <span className="px-1 text-t3">N/A</span>
              )}
            </div>
          </div>
          {entity && (
            <>
              <SidebarLabel>Name</SidebarLabel>
              <div className="col-span-2 flex justify-end min-w-0">
                <span className="truncate max-w-full" title={entity?.name}>
                  {entity?.name}
                </span>
              </div>
              <SidebarLabel>Feature</SidebarLabel>
              <div className="col-span-2 flex justify-end min-w-0">
                <span className="truncate max-w-full" title={featureName.toLowerCase()}>
                  {featureName.toLowerCase()}
                </span>
              </div>
            </>
          )}
        </div>
      </SideAccordion>
    </div>
  );
};
