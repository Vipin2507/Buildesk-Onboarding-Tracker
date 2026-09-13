import { GoogleCalendarConnectPanel } from "@/components/google-calendar-connect-panel";

export function BookingGoogleCalendarPanel({
  flash,
  flashError,
}: {
  flash?: "connected" | "error" | null;
  flashError?: string | null;
}) {
  return <GoogleCalendarConnectPanel variant="crm" flash={flash} flashError={flashError} />;
}
