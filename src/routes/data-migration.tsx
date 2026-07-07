import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, PageWrap } from "@/components/page-header";
import { UploadCard, UPLOAD_TYPE_MAP } from "@/components/upload-card";
import { Pill } from "@/components/status-pill";
import { useOnboardingStore, useProjectStore } from "@/stores";

export const Route = createFileRoute("/data-migration")({
  component: DataMigration,
});

function DataMigration() {
  const projects = useProjectStore((s) => s.projects);
  const projectId = projects[0]?.id ?? "";
  const allUploads = useOnboardingStore((s) => s.uploads);
  const allCustomerRecords = useOnboardingStore((s) => s.customerRecords);
  const allPaymentRecords = useOnboardingStore((s) => s.paymentRecords);
  const uploads = useMemo(() => allUploads.filter((u) => u.projectId === projectId), [allUploads, projectId]);
  const customerRecords = useMemo(
    () => allCustomerRecords.filter((r) => r.projectId === projectId),
    [allCustomerRecords, projectId],
  );
  const paymentRecords = useMemo(
    () => allPaymentRecords.filter((r) => r.projectId === projectId),
    [allPaymentRecords, projectId],
  );
  const simulateUpload = useOnboardingStore((s) => s.simulateUpload);
  const removeUpload = useOnboardingStore((s) => s.removeUpload);

  const cards = [
    { title: "Unit Configuration", description: "Tower / floor / unit master with pricing." },
    { title: "Customer Data", description: "Buyer profiles, contacts and KYC references." },
    { title: "Booking Data", description: "Bookings, allotments, agreement values." },
    { title: "Payment Data", description: "Received payments, demand schedule, dues." },
  ];

  const unitUpload = uploads.find((u) => u.type === "unit");
  const customerUpload = uploads.find((u) => u.type === "customer");
  const bookingUpload = uploads.find((u) => u.type === "booking");
  const paymentUpload = uploads.find((u) => u.type === "payment");

  const verification = [
    { metric: "Total Units", excel: unitUpload?.recordCount ?? 0, crm: unitUpload?.recordCount ?? 0 },
    { metric: "Total Customers", excel: customerUpload?.recordCount ?? 0, crm: customerRecords.length },
    { metric: "Total Bookings", excel: bookingUpload?.recordCount ?? 0, crm: bookingUpload ? bookingUpload.recordCount - 1 : 0 },
    { metric: "Total Payments", excel: paymentUpload?.recordCount ?? 0, crm: paymentRecords.length },
  ];

  return (
    <PageWrap>
      <PageHeader title="Data Migration" subtitle={`Upload, validate and reconcile — ${projects[0]?.name ?? "select a project"}`} />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const type = UPLOAD_TYPE_MAP[c.title];
          const upload = uploads.find((u) => u.type === type);
          return (
            <UploadCard
              key={c.title}
              {...c}
              sampleName={`${c.title.toLowerCase().replace(/\s+/g, "_")}_sample.xlsx`}
              fileName={upload?.fileName}
              uploadedAt={upload?.uploadedAt}
              recordCount={upload?.recordCount}
              onUpload={(name) => simulateUpload(projectId, type, name)}
              onRemove={upload ? () => removeUpload(upload.id) : undefined}
            />
          );
        })}
      </div>
      <div className="card-soft mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Verification Dashboard</h3>
          <Pill tone="info">Excel ↔ CRM reconciliation</Pill>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Metric</th>
                <th className="px-4 py-2 text-right">Excel Count</th>
                <th className="px-4 py-2 text-right">CRM Count</th>
                <th className="px-4 py-2 text-right">Difference</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {verification.map((v) => {
                const diff = v.excel - v.crm;
                return (
                  <tr key={v.metric} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{v.metric}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{v.excel}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{v.crm}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{diff}</td>
                    <td className="px-4 py-2.5">{diff === 0 ? <Pill tone="success">Matched</Pill> : <Pill tone="warning">Not Matched</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrap>
  );
}
