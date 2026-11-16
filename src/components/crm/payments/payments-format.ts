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
};
