export function formatPaymentsInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export type PaymentsSummaryView = {
  totalContractValue: number;
  totalReceived: number;
  totalPending: number;
  totalOverdueAmount: number;
  overdueAccountCount: number;
  dueThisWeekAmount: number;
  dueThisWeekCount: number;
  dueThisMonthAmount: number;
  dueThisMonthCount: number;
  dueIn45DaysAmount: number;
  dueIn45DaysCount: number;
  collectionRatePercent: number;
  accountCount?: number;
  suspendedCount?: number;
  suspendedDealValue?: number;
  suspendAndCloseCount?: number;
  salesLostCount?: number;
  salesLostAmount?: number;
  salesLostDealValue?: number;
  salesLostPaidAmount?: number;
  customerLostCount?: number;
  customerLostAmount?: number;
  customerLostDealValue?: number;
  customerLostPaidAmount?: number;
  collectionTrend?: { month: string; label: string; collected: number }[];
  statusCounts?: Record<string, number>;
  analysis?: {
    installmentCount: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
    overdueInstallmentCount: number;
    scheduledAmount: number;
    paidOnInstallments: number;
    remainingAmount: number;
    renewalInstallmentRemaining: number;
    renewalAccountCount: number;
    renewalCollected: number;
    avgCollectionPercent: number;
    schedule: {
      month: string;
      label: string;
      dealRemaining: number;
      renewalRemaining: number;
      count: number;
    }[];
    renewalsByMonth: { month: string; label: string; count: number; dealValue: number }[];
    collectionBands: { key: string; label: string; count: number; pending: number }[];
    bySupport: {
      name: string;
      accounts: number;
      received: number;
      pending: number;
      rate: number;
    }[];
    largestPending: {
      id: string;
      name: string;
      pending: number;
      received: number;
      deal: number;
      percent: number;
    }[];
    largestOverdue: { id: string; name: string; overdue: number; days: number | null }[];
  };
};
