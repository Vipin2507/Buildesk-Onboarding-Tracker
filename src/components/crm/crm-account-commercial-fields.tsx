import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import { DatePickerField } from "@/components/date-picker-field";
import {
  buildInstallmentSchedule,
  calcDealFromPerUser,
  calcInstallmentAmount,
  calcValuePerUser,
  installmentBaseAmount,
  roundMoney,
} from "@/lib/crm-account-commercial";
import { cn, formatDate } from "@/lib/utils";
import type { CrmAccountFormValues } from "@/components/crm/crm-account-form";

type CommercialDriver =
  | "dealSize"
  | "valuePerUser"
  | "usersPurchased"
  | "pendingAmount"
  | "installmentCount"
  | "installmentAmount";

function fieldClass(hasError?: boolean, readOnly?: boolean) {
  return cn(
    "mt-1.5 h-9 w-full rounded-lg border border-border/80 bg-background px-3 text-sm outline-none transition-[box-shadow,border-color] duration-200",
    "focus:border-primary/45 focus:ring-2 focus:ring-primary/20",
    hasError && "border-destructive focus:border-destructive focus:ring-destructive/25",
    readOnly && "cursor-default bg-muted/40 text-muted-foreground",
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-destructive">{message}</p>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[11px] font-medium text-muted-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

export function CrmAccountCommercialFields({
  form,
}: {
  form: UseFormReturn<CrmAccountFormValues>;
}) {
  const errors = form.formState.errors;
  const driverRef = useRef<CommercialDriver | null>(null);

  const usersPurchased = Number(form.watch("usersPurchased")) || 0;
  const dealSize = Number(form.watch("dealSize")) || 0;
  const valuePerUser = Number(form.watch("valuePerUser")) || 0;
  const pendingAmount = Number(form.watch("pendingAmount")) || 0;
  const installmentCount = Number(form.watch("installmentCount")) || 0;
  const installmentAmount = Number(form.watch("installmentAmount")) || 0;
  const startDate = form.watch("startDate") ?? "";
  const installments = form.watch("installments") ?? [];
  const paymentReceived = Math.max(0, roundMoney(dealSize - pendingAmount));

  function setCommercial(
    patch: Partial<CrmAccountFormValues>,
    opts?: { shouldValidate?: boolean },
  ) {
    const validate = opts?.shouldValidate ?? false;
    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key as keyof CrmAccountFormValues, value as never, {
        shouldDirty: true,
        shouldValidate: validate,
      });
    }
  }

  function syncInstallments(count: number, amountEach?: number) {
    const base = installmentBaseAmount(dealSize, pendingAmount);
    const rows = buildInstallmentSchedule({
      totalAmount: base,
      count,
      startDate,
      amountEach,
    });
    setCommercial({
      installmentCount: count,
      installments: rows,
      installmentAmount:
        amountEach ?? (rows[0]?.amount ?? calcInstallmentAmount(base, count)),
    });
  }

  useEffect(() => {
    const driver = driverRef.current;
    if (!driver) return;

    if (driver === "dealSize" || driver === "usersPurchased") {
      const nextPerUser = calcValuePerUser(dealSize, usersPurchased);
      if (nextPerUser !== valuePerUser) {
        setCommercial({ valuePerUser: nextPerUser });
      }
    }

    if (driver === "valuePerUser") {
      const nextDeal = calcDealFromPerUser(valuePerUser, usersPurchased);
      if (nextDeal !== dealSize) {
        setCommercial({ dealSize: nextDeal });
      }
    }

    if (
      driver === "dealSize" ||
      driver === "pendingAmount" ||
      driver === "installmentCount" ||
      driver === "installmentAmount"
    ) {
      if (installmentCount > 0) {
        const amountEach = driver === "installmentAmount" ? installmentAmount : undefined;
        syncInstallments(installmentCount, amountEach);
      }
    }

    driverRef.current = null;
  }, [
    dealSize,
    usersPurchased,
    valuePerUser,
    pendingAmount,
    installmentCount,
    installmentAmount,
    startDate,
  ]);

  function markDriver(driver: CommercialDriver) {
    driverRef.current = driver;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label required>Users purchased</Label>
          <input
            type="number"
            min={1}
            step={1}
            {...form.register("usersPurchased", {
              valueAsNumber: true,
              onChange: () => markDriver("usersPurchased"),
            })}
            className={fieldClass(!!errors.usersPurchased)}
          />
          <FieldError message={errors.usersPurchased?.message} />
        </div>
        <div>
          <Label>Total deal value (₹)</Label>
          <input
            type="number"
            min={0}
            step="any"
            {...form.register("dealSize", {
              valueAsNumber: true,
              onChange: () => markDriver("dealSize"),
            })}
            className={fieldClass(!!errors.dealSize)}
          />
          <FieldError message={errors.dealSize?.message} />
        </div>
        <div>
          <Label>Value per user (₹)</Label>
          <input
            type="number"
            min={0}
            step="any"
            {...form.register("valuePerUser", {
              valueAsNumber: true,
              onChange: () => markDriver("valuePerUser"),
            })}
            className={fieldClass(!!errors.valuePerUser)}
          />
          <FieldError message={errors.valuePerUser?.message} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Edit deal value or per-user — the other updates automatically.
          </p>
        </div>
        <div>
          <Label>Pending amount (₹)</Label>
          <input
            type="number"
            min={0}
            step="any"
            {...form.register("pendingAmount", {
              valueAsNumber: true,
              onChange: () => markDriver("pendingAmount"),
            })}
            className={fieldClass(!!errors.pendingAmount)}
          />
          <FieldError message={errors.pendingAmount?.message} />
        </div>
        <div>
          <Label>Payment received (₹)</Label>
          <input
            readOnly
            value={paymentReceived}
            className={fieldClass(false, true)}
            tabIndex={-1}
          />
        </div>
        <div>
          <Label required>Start date</Label>
          <DatePickerField
            modal
            className="mt-1.5"
            value={startDate}
            onChange={(v) => {
              form.setValue("startDate", v, { shouldValidate: true, shouldDirty: true });
              if (installmentCount > 0) {
                markDriver("installmentCount");
              }
            }}
          />
          <FieldError message={errors.startDate?.message} />
        </div>
        <div>
          <Label required>End date</Label>
          <DatePickerField
            modal
            className="mt-1.5"
            value={form.watch("endDate") ?? ""}
            onChange={(v) =>
              form.setValue("endDate", v, { shouldValidate: true, shouldDirty: true })
            }
          />
          <FieldError message={errors.endDate?.message} />
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/10 p-3">
        <div className="mb-2 text-xs font-semibold">Installment plan</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>No. of installments</Label>
            <input
              type="number"
              min={0}
              step={1}
              {...form.register("installmentCount", {
                valueAsNumber: true,
                onChange: (e) => {
                  markDriver("installmentCount");
                  const count = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  if (count === 0) {
                    setCommercial({ installments: [], installmentAmount: 0 });
                  }
                },
              })}
              className={fieldClass(!!errors.installmentCount)}
            />
            <FieldError message={errors.installmentCount?.message} />
          </div>
          <div>
            <Label>Installment value (₹)</Label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("installmentAmount", {
                valueAsNumber: true,
                onChange: () => markDriver("installmentAmount"),
              })}
              className={fieldClass(!!errors.installmentAmount)}
            />
            <FieldError message={errors.installmentAmount?.message} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Based on pending amount
              {pendingAmount <= 0 && dealSize > 0 ? " (using deal value)" : ""}.
            </p>
          </div>
        </div>

        {installments.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  <th className="px-2 py-1.5 text-left font-medium">Amount (₹)</th>
                  <th className="px-2 py-1.5 text-left font-medium">Due date</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((row, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={row.amount}
                        onChange={(e) => {
                          const next = [...installments];
                          next[index] = {
                            ...next[index],
                            amount: roundMoney(Number(e.target.value) || 0),
                          };
                          setCommercial({ installments: next });
                        }}
                        className={cn(fieldClass(), "mt-0 h-8")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DatePickerField
                        compact
                        modal
                        value={row.dueDate}
                        onChange={(v) => {
                          const next = [...installments];
                          next[index] = { ...next[index], dueDate: v };
                          setCommercial({ installments: next });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground">
              Total scheduled: ₹
              {installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0).toLocaleString("en-IN")}
              {" · "}
              First due {installments[0]?.dueDate ? formatDate(installments[0].dueDate) : "—"}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Set the number of installments to generate due dates from the contract start date.
          </p>
        )}
      </div>
    </div>
  );
}
