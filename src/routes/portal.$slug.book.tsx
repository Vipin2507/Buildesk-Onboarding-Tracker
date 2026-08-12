import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePickerField } from "@/components/date-picker-field";
import {
  DesignTicketFormCard,
  DesignTicketFormField,
  DesignTicketPageHeader,
  PortalPageWrap,
  TICKET_EASE,
  ticketFieldClass,
  ticketPageVariants,
  ticketSectionVariants,
  ticketTextareaClass,
} from "@/components/design-ticket/design-ticket-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { browserWallClockIso } from "@/lib/booking-slots";
import { getCrmMasterBookingCallTypes } from "@/stores/useCrmMasterStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import type { BookingEventType, BookingSlot } from "@/types/booking";

export const Route = createFileRoute("/portal/$slug/book")({
  component: PortalBookCall,
});

const OTHER_DURATION_OPTIONS = [15, 30, 45, 60];

function formatSlotLabel(startsAt: string) {
  const time = startsAt.slice(11, 16);
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function addDaysYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayYmd() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function callTypeMeta(event: BookingEventType | null) {
  if (!event) return null;
  const fromMaster = getCrmMasterBookingCallTypes().find((c) => c.key === event.slug);
  if (fromMaster) return fromMaster;
  const allowsCustomDuration =
    event.slug === "other" || /other/i.test(event.title);
  return {
    key: event.slug,
    label: event.title,
    durationMinutes: event.durationMinutes,
    allowsCustomDuration,
    isActive: true,
    order: 0,
  };
}

function PortalBookCall() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const listPortalEventTypes = useBookingStore((s) => s.listPortalEventTypes);
  const listPortalSlots = useBookingStore((s) => s.listPortalSlots);
  const createPortalRequest = useBookingStore((s) => s.createPortalRequest);

  const [step, setStep] = useState<"type" | "slot" | "form" | "done">("type");
  const [eventTypes, setEventTypes] = useState<BookingEventType[]>([]);
  const [selectedType, setSelectedType] = useState<BookingEventType | null>(null);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [specifyTopic, setSpecifyTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  const selectedMeta = useMemo(() => callTypeMeta(selectedType), [selectedType]);
  const allowsCustom = Boolean(selectedMeta?.allowsCustomDuration);
  const effectiveDuration =
    allowsCustom && customDuration
      ? customDuration
      : selectedType?.durationMinutes ?? selectedMeta?.durationMinutes;

  const minDate = todayYmd();

  function pickDate(next: string) {
    if (!next || next < minDate) {
      setDate(minDate);
      return;
    }
    setDate(next);
  }

  useEffect(() => {
    if (!access) return;
    setGuestName(access.contactName || "");
    setGuestEmail(access.contactEmail || "");
    void listPortalEventTypes(slug)
      .then((rows) => {
        setEventTypes(rows);
        if (rows.length === 1) {
          setSelectedType(rows[0]);
          setStep("slot");
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load meeting types");
      });
  }, [access, listPortalEventTypes, slug]);

  useEffect(() => {
    if (!selectedType || step !== "slot") return;
    if (allowsCustom && !customDuration) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const to = addDaysYmd(date, 0);
    void listPortalSlots(slug, selectedType.id, date, to, effectiveDuration)
      .then((rows) => {
        if (!cancelled) setSlots(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          toast.error(err instanceof Error ? err.message : "Failed to load slots");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    allowsCustom,
    customDuration,
    date,
    effectiveDuration,
    listPortalSlots,
    selectedType,
    slug,
    step,
  ]);

  const daySlots = useMemo(() => {
    const now = browserWallClockIso();
    return slots
      .filter((s) => s.startsAt.startsWith(date))
      .filter((s) => s.startsAt.slice(0, 19) > now);
  }, [date, slots]);

  if (!access) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType || !selectedSlot) return;
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (allowsCustom && !specifyTopic.trim()) {
      toast.error("Please specify what the call is about");
      return;
    }
    if (selectedSlot.startsAt.slice(0, 19) <= browserWallClockIso()) {
      toast.error("That time has passed — please pick a later slot");
      return;
    }
    setSubmitting(true);
    try {
      const noteParts = [
        allowsCustom && specifyTopic.trim() ? `Topic: ${specifyTopic.trim()}` : "",
        notes.trim(),
      ].filter(Boolean);
      const created = await createPortalRequest({
        slug,
        eventTypeId: selectedType.id,
        startsAt: selectedSlot.startsAt,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
        durationMinutes: allowsCustom ? effectiveDuration : undefined,
      });
      setConfirmationId(created.id);
      setStep("done");
      toast.success("Booking request submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalPageWrap>
      <motion.div variants={ticketPageVariants} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={ticketSectionVariants}>
          <DesignTicketPageHeader
            title="Book a call"
            subtitle="Pick a time that works — we'll confirm shortly."
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "type" && (
            <motion.div
              key="type"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {eventTypes.map((et) => {
                const meta = callTypeMeta(et);
                return (
                  <button
                    key={et.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(et);
                      setCustomDuration(meta?.allowsCustomDuration ? null : null);
                      setSpecifyTopic("");
                      setStep("slot");
                    }}
                    className="card-soft flex w-full items-start gap-3 p-4 text-left transition hover:border-primary/40"
                  >
                    <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <div className="text-sm font-semibold">{et.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta?.allowsCustomDuration
                          ? "Choose length when booking"
                          : `${et.durationMinutes} minutes`}
                      </div>
                    </div>
                  </button>
                );
              })}
              {eventTypes.length === 0 && (
                <p className="text-sm text-muted-foreground">No meeting types available yet.</p>
              )}
            </motion.div>
          )}

          {step === "slot" && selectedType && (
            <motion.div
              key="slot"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                {eventTypes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => setStep("type")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                <div className="text-sm font-medium">{selectedType.title}</div>
              </div>

              <DesignTicketFormCard>
                {allowsCustom ? (
                  <DesignTicketFormField label="Call length">
                    <div className="flex flex-wrap gap-2">
                      {OTHER_DURATION_OPTIONS.map((mins) => {
                        const active = customDuration === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setCustomDuration(mins)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs font-medium transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background hover:border-primary/50",
                            )}
                          >
                            {mins} min
                          </button>
                        );
                      })}
                    </div>
                  </DesignTicketFormField>
                ) : null}

                <DesignTicketFormField label="Date">
                  <DatePickerField
                    value={date}
                    onChange={pickDate}
                    min={minDate}
                    yearsBack={0}
                    yearsForward={1}
                  />
                </DesignTicketFormField>

                <DesignTicketFormField label="Available times">
                  {allowsCustom && !customDuration ? (
                    <p className="text-xs text-muted-foreground">Choose a call length first.</p>
                  ) : loadingSlots ? (
                    <p className="text-xs text-muted-foreground">Loading slots…</p>
                  ) : daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No open slots this day. Try another date.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((slot) => {
                        const active = selectedSlot?.startsAt === slot.startsAt;
                        return (
                          <motion.button
                            key={slot.startsAt}
                            type="button"
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, ease: TICKET_EASE }}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs font-medium transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background hover:border-primary/50",
                            )}
                          >
                            {formatSlotLabel(slot.startsAt)}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </DesignTicketFormField>

                <Button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={() => setStep("form")}
                  className="w-full sm:w-auto"
                >
                  Continue
                </Button>
              </DesignTicketFormCard>
            </motion.div>
          )}

          {step === "form" && selectedType && selectedSlot && (
            <motion.form
              key="form"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              onSubmit={onSubmit}
              className="space-y-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setStep("slot")}
              >
                <ChevronLeft className="h-4 w-4" />
                Change time
              </Button>

              <DesignTicketFormCard>
                <p className="text-xs text-muted-foreground">
                  {selectedType.title}
                  {effectiveDuration ? ` · ${effectiveDuration} min` : ""} · {date} ·{" "}
                  {formatSlotLabel(selectedSlot.startsAt)}
                </p>
                {allowsCustom ? (
                  <DesignTicketFormField label="Please specify">
                    <input
                      value={specifyTopic}
                      onChange={(e) => setSpecifyTopic(e.target.value)}
                      className={ticketFieldClass}
                      placeholder="What should we cover on this call?"
                      required
                    />
                  </DesignTicketFormField>
                ) : null}
                <DesignTicketFormField label="Your name">
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className={ticketFieldClass}
                    required
                  />
                </DesignTicketFormField>
                <DesignTicketFormField label="Email">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className={ticketFieldClass}
                    required
                  />
                </DesignTicketFormField>
                <DesignTicketFormField label="Phone (optional)">
                  <input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className={ticketFieldClass}
                  />
                </DesignTicketFormField>
                <DesignTicketFormField label="Notes (optional)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={ticketTextareaClass}
                    rows={3}
                    placeholder="Anything we should know beforehand?"
                  />
                </DesignTicketFormField>
                <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? "Submitting…" : "Request booking"}
                </Button>
              </DesignTicketFormCard>
            </motion.form>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: TICKET_EASE }}
              className="card-soft flex flex-col items-center gap-3 p-8 text-center"
            >
              <CheckCircle2 className="h-10 w-10 text-success" />
              <h2 className="text-lg font-semibold">Request received</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your booking is pending confirmation. Check status on your dashboard — we'll also
                email you when it's approved, cancelled, or postponed.
              </p>
              {selectedSlot && (
                <p className="text-xs text-muted-foreground">
                  Requested: {date} · {formatSlotLabel(selectedSlot.startsAt)}
                  {confirmationId ? ` · Ref ${confirmationId.slice(0, 8)}` : ""}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(eventTypes.length > 1 ? "type" : "slot");
                  setSelectedSlot(null);
                  setConfirmationId(null);
                  setNotes("");
                  setSpecifyTopic("");
                  setCustomDuration(null);
                }}
              >
                Book another
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PortalPageWrap>
  );
}
