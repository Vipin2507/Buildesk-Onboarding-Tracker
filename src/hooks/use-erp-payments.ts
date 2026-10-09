import { useQuery } from "@tanstack/react-query";

import { listErpCompanyPayments } from "@/lib/api";

export const erpPaymentsKeys = {
  all: ["erp-payments"] as const,
  list: () => [...erpPaymentsKeys.all, "list"] as const,
};

export function useErpCompanyPaymentsList() {
  return useQuery({
    queryKey: erpPaymentsKeys.list(),
    queryFn: () => listErpCompanyPayments(),
    staleTime: 15_000,
  });
}
