import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { CrmAccountProductModulesPicker } from "@/components/crm/crm-account-product-modules-picker";
import {
  DesignTicketSection,
  TICKET_EASE,
} from "@/components/design-ticket/design-ticket-shared";
import { EntityFormModal } from "@/components/entity-form-modal";
import { Pill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isCrmCoreModule } from "@/data/crm-onboarding-defaults";
import { getCrmMasterProductModuleCatalog } from "@/stores/useCrmMasterStore";
import { useCrmOnboardingStore } from "@/stores";
import type { CrmProductModuleKey } from "@/types/crm-onboarding";

type Props = {
  companyId: string;
};

export function CrmAccountModulesTab({ companyId }: Props) {
  const record = useCrmOnboardingStore((s) => s.getByCompanyId(companyId))!;
  const setEnabled = useCrmOnboardingStore((s) => s.setProductModuleEnabled);

  const catalogKeys = useMemo(
    () => new Set(getCrmMasterProductModuleCatalog().map((m) => m.key)),
    [],
  );

  const inScope = (key: CrmProductModuleKey) => isCrmCoreModule(key) && catalogKeys.has(key);

  const enabled = record.productModules.filter((m) => m.enabled && inScope(m.key));
  const available = record.productModules.filter((m) => !m.enabled && inScope(m.key));

  const [addOpen, setAddOpen] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<CrmProductModuleKey[]>([]);

  function openAddModule() {
    setPickerSelected([]);
    setAddOpen(true);
  }

  function confirmAddModules() {
    const enabledKeys = new Set(enabled.map((m) => m.key));
    const toAdd = pickerSelected.filter((key) => !enabledKeys.has(key));
    if (toAdd.length === 0) {
      toast.error("Select at least one module that is not already subscribed");
      return;
    }
    for (const key of toAdd) {
      setEnabled(companyId, key, true);
    }
    toast.success(`Added ${toAdd.length} module${toAdd.length === 1 ? "" : "s"}`);
    setAddOpen(false);
  }

  return (
    <>
      <div className="space-y-2.5">
        <DesignTicketSection
          compact
          title="Subscribed modules"
          action={
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {enabled.length} opted
              </span>
              {available.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={openAddModule}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add module
                </Button>
              ) : null}
            </div>
          }
        >
          <p className="mb-2 text-[10px] text-muted-foreground">
            Core CRM product modules for this account. Use Add module to opt in additional modules
            after account creation.
          </p>

          {enabled.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No modules subscribed yet.
              {available.length > 0 ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={openAddModule}
                  >
                    Add a module
                  </button>{" "}
                  to get started.
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {enabled.map((m) => (
                  <motion.div
                    key={m.key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: TICKET_EASE }}
                    className="card-soft flex items-center justify-between gap-2 p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{m.label}</div>
                        <Pill tone="success" className="mt-0.5 text-[10px]">
                          Subscribed
                        </Pill>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      checked={m.enabled}
                      onCheckedChange={(v) => {
                        setEnabled(companyId, m.key, v === true);
                        toast.success(v ? `${m.label} subscribed` : `${m.label} removed`);
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </DesignTicketSection>

        {available.length > 0 ? (
          <DesignTicketSection compact title="Available modules">
            <p className="mb-2 text-[10px] text-muted-foreground">
              Toggle to subscribe this account to a module, or use Add module above.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((m) => (
                <label
                  key={m.key}
                  className="card-soft flex cursor-pointer items-center justify-between gap-2 p-2.5 text-xs transition-colors hover:bg-muted/20"
                >
                  <span className="min-w-0 truncate font-medium">{m.label}</span>
                  <Switch
                    size="sm"
                    checked={m.enabled}
                    onCheckedChange={(v) => {
                      setEnabled(companyId, m.key, v === true);
                      toast.success(v ? `${m.label} subscribed` : `${m.label} removed`);
                    }}
                  />
                </label>
              ))}
            </div>
          </DesignTicketSection>
        ) : enabled.length > 0 ? (
          <p className="text-center text-[11px] text-muted-foreground">
            All catalog modules are subscribed for this account.
          </p>
        ) : null}
      </div>

      <EntityFormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add modules"
        submitLabel="Add selected"
        onSubmit={confirmAddModules}
        contentClassName="max-w-2xl"
      >
        <p className="mb-3 text-xs text-muted-foreground">
          Select one or more modules to subscribe this account to.
        </p>
        <CrmAccountProductModulesPicker selected={pickerSelected} onChange={setPickerSelected} />
      </EntityFormModal>
    </>
  );
}
