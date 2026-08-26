import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Mail,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";
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
import { cn, isValidEmail } from "@/lib/utils";
import { formatGuestEmailsLabel } from "@/lib/booking-guest-emails";
import { browserWallClockIso } from "@/lib/booking-slots";
import { getCrmMasterBookingCallTypes } from "@/stores/useCrmMasterStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useCompanyPortalStore } from "@/stores/useCompanyPortalStore";
import type { BookingEventType, BookingSlot } from "@/types/booking";

export const Route = createFileRoute("/portal/$slug/book")({
  component: PortalBookCall,
});

const OTHER_DURATION_OPTIONS = [15, 30, 45, 60];

type BookStep = "contact" | "type" | "slot" | "form" | "done";

const FLOW_STEPS: { id: BookStep; label: string }[] = [
  { id: "contact", label: "Contact" },
  { id: "type", label: "Call type" },
  { id: "slot", label: "Date & time" },
  { id: "form", label: "Confirm" },
];

function formatSlotLabel(startsAt: string) {
  const time = startsAt.slice(11, 16);
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateLabel(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const allowsCustomDuration = event.slug === "other" || /other/i.test(event.title);
  return {
    key: event.slug,
    label: event.title,
    durationMinutes: event.durationMinutes,
    allowsCustomDuration,
    isActive: true,
    order: 0,
  };
}

function BookingStepBar({ step }: { step: BookStep }) {
  if (step === "done") return null;
  const visible = FLOW_STEPS.filter((s) => s.id !== "contact" || step === "contact");
  const activeIdx = visible.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-1">
      {visible.map((s, i) => {
        const done = i < activeIdx;
        const active = s.id === step;
        return (
          <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                done || active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={cn(
                "hidden truncate text-[10px] font-medium sm:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < visible.length - 1 ? (
              <div
                className={cn(
                  "mx-0.5 h-px min-w-[0.75rem] flex-1",
                  done ? "bg-primary/50" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BookingSummary({
  selectedType,
  effectiveDuration,
  date,
  selectedSlot,
  guestName,
  guestEmail,
  additionalGuestEmails = [],
}: {
  selectedType: BookingEventType | null;
  effectiveDuration?: number;
  date?: string;
  selectedSlot?: BookingSlot | null;
  guestName?: string;
  guestEmail?: string;
  additionalGuestEmails?: string[];
}) {
  const emailLabel = formatGuestEmailsLabel({
    guestEmail: guestEmail ?? "",
    additionalGuestEmails,
  });
  if (!selectedType && !guestEmail) return null;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        Booking summary
      </div>
      <div className="mt-1.5 space-y-0.5 text-muted-foreground">
        {selectedType ? (
          <div>
            <span className="font-medium text-foreground">{selectedType.title}</span>
            {effectiveDuration ? ` · ${effectiveDuration} min` : ""}
          </div>
        ) : null}
        {date && selectedSlot ? (
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatDateLabel(date)} · {formatSlotLabel(selectedSlot.startsAt)}
          </div>
        ) : null}
        {guestName || guestEmail ? (
          <div className="flex items-start gap-1">
            <User className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0 break-words">
              {guestName || "—"}
              {emailLabel ? ` · ${emailLabel}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GuestEmailsField({
  primaryEmail,
  onPrimaryEmailChange,
  additionalEmails,
  onAdditionalEmailsChange,
  emailTouched,
  onEmailTouched,
  compact = false,
}: {
  primaryEmail: string;
  onPrimaryEmailChange: (value: string) => void;
  additionalEmails: string[];
  onAdditionalEmailsChange: (value: string[]) => void;
  emailTouched: boolean;
  onEmailTouched: () => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const primaryError =
    emailTouched && !isValidEmail(primaryEmail) ? "Enter a valid email address" : undefined;

  function addEmail() {
    onEmailTouched();
    const next = draft.trim().toLowerCase();
    if (!isValidEmail(next)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (next === primaryEmail.trim().toLowerCase()) {
      toast.error("This email is already set as your primary contact");
      return;
    }
    if (additionalEmails.includes(next)) {
      toast.error("Email already added");
      return;
    }
    onAdditionalEmailsChange([...additionalEmails, next]);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      <DesignTicketFormField
        label="Primary email"
        required
        hint="Required — used for booking confirmations and Google Meet invites."
        error={primaryError}
      >
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={primaryEmail}
            onChange={(e) => onPrimaryEmailChange(e.target.value)}
            onBlur={onEmailTouched}
            className={cn(ticketFieldClass, "pl-9", primaryError && "border-destructive")}
            placeholder="you@company.com"
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>
      </DesignTicketFormField>

      <DesignTicketFormField
        label="Additional emails"
        hint="Optional — add colleagues who should receive confirmations and Meet invites."
      >
        <div className={cn("flex gap-2", compact && "flex-col sm:flex-row")}>
          <div className="relative min-w-0 flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEmail();
                }
              }}
              className={cn(ticketFieldClass, "pl-9")}
              placeholder="colleague@company.com"
              inputMode="email"
            />
          </div>
          <Button type="button" variant="outline" className="shrink-0 gap-1" onClick={addEmail}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {additionalEmails.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {additionalEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px]"
              >
                {email}
                <button
                  type="button"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${email}`}
                  onClick={() =>
                    onAdditionalEmailsChange(additionalEmails.filter((item) => item !== email))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </DesignTicketFormField>
    </div>
  );
}

function PortalBookCall() {
  const { slug } = Route.useParams();
  const access = useCompanyPortalStore((s) => s.getBySlug(slug));
  const listPortalEventTypes = useBookingStore((s) => s.listPortalEventTypes);
  const listPortalSlots = useBookingStore((s) => s.listPortalSlots);
  const createPortalRequest = useBookingStore((s) => s.createPortalRequest);

  const [step, setStep] = useState<BookStep>("contact");
  const [eventTypes, setEventTypes] = useState<BookingEventType[]>([]);
  const [selectedType, setSelectedType] = useState<BookingEventType | null>(null);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [date, setDate] = useState(todayYmd());
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [additionalGuestEmails, setAdditionalGuestEmails] = useState<string[]>([]);
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [specifyTopic, setSpecifyTopic] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  const selectedMeta = useMemo(() => callTypeMeta(selectedType), [selectedType]);
  const allowsCustom = Boolean(selectedMeta?.allowsCustomDuration);
  const effectiveDuration =
    allowsCustom && customDuration
      ? customDuration
      : selectedType?.durationMinutes ?? selectedMeta?.durationMinutes;

  const minDate = todayYmd();
  const canContinueContact = guestName.trim().length >= 2 && isValidEmail(guestEmail);

  function pickDate(next: string) {
    if (!next || next < minDate) {
      setDate(minDate);
      return;
    }
    setDate(next);
  }

  useEffect(() => {
    if (!access) return;
    const name = access.contactName?.trim() || "";
    const email = access.contactEmail?.trim() || "";
    setGuestName(name);
    setGuestEmail(email);
    const startAtContact = !isValidEmail(email) || name.length < 2;
    void listPortalEventTypes(slug)
      .then((rows) => {
        setEventTypes(rows);
        if (startAtContact) {
          setStep("contact");
        } else if (rows.length === 1) {
          setSelectedType(rows[0]);
          setStep("slot");
        } else {
          setStep("type");
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
    setEmailTouched(true);
    if (!guestName.trim() || guestName.trim().length < 2) {
      toast.error("Enter your name");
      return;
    }
    if (!isValidEmail(guestEmail)) {
      toast.error("A valid email address is required");
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
        guestEmail: guestEmail.trim().toLowerCase(),
        additionalGuestEmails,
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
      <motion.div
        variants={ticketPageVariants}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-2xl space-y-4"
      >
        <motion.div variants={ticketSectionVariants} className="space-y-3">
          <DesignTicketPageHeader
            title="Book a call"
            subtitle="Choose a time — we'll confirm by email once approved."
          />
          <BookingStepBar step={step} />
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "contact" && (
            <motion.div
              key="contact"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
            >
              <DesignTicketFormCard>
                <p className="text-xs text-muted-foreground">
                  Add your email and any colleagues who should receive confirmations and Meet links.
                </p>
                <DesignTicketFormField label="Your name" required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className={cn(ticketFieldClass, "pl-9")}
                      placeholder="Full name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </DesignTicketFormField>
                <GuestEmailsField
                  primaryEmail={guestEmail}
                  onPrimaryEmailChange={setGuestEmail}
                  additionalEmails={additionalGuestEmails}
                  onAdditionalEmailsChange={setAdditionalGuestEmails}
                  emailTouched={emailTouched}
                  onEmailTouched={() => setEmailTouched(true)}
                />
                <Button
                  type="button"
                  disabled={!canContinueContact}
                  className="w-full"
                  onClick={() => {
                    setEmailTouched(true);
                    if (!canContinueContact) {
                      toast.error("Name and a valid email are required");
                      return;
                    }
                    if (eventTypes.length === 1) {
                      setSelectedType(eventTypes[0]);
                      setStep("slot");
                    } else {
                      setStep("type");
                    }
                  }}
                >
                  Continue
                </Button>
              </DesignTicketFormCard>
            </motion.div>
          )}

          {step === "type" && (
            <motion.div
              key="type"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <BookingSummary
                guestName={guestName}
                guestEmail={guestEmail}
                additionalGuestEmails={additionalGuestEmails}
                selectedType={null}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {eventTypes.map((et) => {
                  const meta = callTypeMeta(et);
                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(et);
                        setCustomDuration(null);
                        setSpecifyTopic("");
                        setStep("slot");
                      }}
                      className="card-soft group flex items-start gap-3 p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{et.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {meta?.allowsCustomDuration
                            ? "Flexible duration"
                            : `${et.durationMinutes} minutes`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {eventTypes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No meeting types available yet.
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setStep("contact")}
              >
                <ChevronLeft className="h-4 w-4" />
                Edit contact
              </Button>
            </motion.div>
          )}

          {step === "slot" && selectedType && (
            <motion.div
              key="slot"
              variants={ticketSectionVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <BookingSummary
                selectedType={selectedType}
                effectiveDuration={effectiveDuration}
                guestName={guestName}
                guestEmail={guestEmail}
                additionalGuestEmails={additionalGuestEmails}
              />

              <DesignTicketFormCard>
                <div className="flex items-center justify-between gap-2">
                  {eventTypes.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => setStep("type")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Change type
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => setStep("contact")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Edit contact
                    </Button>
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedType.title}
                  </span>
                </div>

                {allowsCustom ? (
                  <DesignTicketFormField label="Call length" required>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {OTHER_DURATION_OPTIONS.map((mins) => {
                        const active = customDuration === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setCustomDuration(mins)}
                            className={cn(
                              "rounded-lg border px-3 py-2.5 text-xs font-medium transition",
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

                <DesignTicketFormField label="Date" required>
                  <DatePickerField
                    value={date}
                    onChange={pickDate}
                    min={minDate}
                    yearsBack={0}
                    yearsForward={1}
                  />
                </DesignTicketFormField>

                <DesignTicketFormField label="Available times" required>
                  {allowsCustom && !customDuration ? (
                    <p className="text-xs text-muted-foreground">Choose a call length first.</p>
                  ) : loadingSlots ? (
                    <p className="text-xs text-muted-foreground">Loading available times…</p>
                  ) : daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No open slots on this day. Try another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                              "rounded-lg border px-2 py-2.5 text-xs font-medium transition",
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
                  className="w-full"
                  onClick={() => setStep("form")}
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
              className="space-y-3"
            >
              <BookingSummary
                selectedType={selectedType}
                effectiveDuration={effectiveDuration}
                date={date}
                selectedSlot={selectedSlot}
                guestName={guestName}
                guestEmail={guestEmail}
                additionalGuestEmails={additionalGuestEmails}
              />

              <DesignTicketFormCard>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 gap-1 text-muted-foreground"
                  onClick={() => setStep("slot")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Change time
                </Button>

                <DesignTicketFormField label="Your name" required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className={cn(ticketFieldClass, "pl-9")}
                      required
                    />
                  </div>
                </DesignTicketFormField>

                <GuestEmailsField
                  primaryEmail={guestEmail}
                  onPrimaryEmailChange={setGuestEmail}
                  additionalEmails={additionalGuestEmails}
                  onAdditionalEmailsChange={setAdditionalGuestEmails}
                  emailTouched={emailTouched}
                  onEmailTouched={() => setEmailTouched(true)}
                  compact
                />

                {allowsCustom ? (
                  <DesignTicketFormField label="What is this call about?" required>
                    <textarea
                      value={specifyTopic}
                      onChange={(e) => setSpecifyTopic(e.target.value)}
                      className={ticketTextareaClass}
                      placeholder="Brief topic or agenda…"
                      rows={2}
                      required
                    />
                  </DesignTicketFormField>
                ) : null}

                <DesignTicketFormField label="Phone" hint="Optional">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className={cn(ticketFieldClass, "pl-9")}
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                </DesignTicketFormField>

                <DesignTicketFormField label="Notes" hint="Optional">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={ticketTextareaClass}
                    rows={3}
                    placeholder="Anything we should know beforehand?"
                  />
                </DesignTicketFormField>

                <Button
                  type="submit"
                  disabled={submitting || !isValidEmail(guestEmail) || guestName.trim().length < 2}
                  className="w-full"
                >
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
              className="card-soft mx-auto flex w-full max-w-lg flex-col items-center gap-4 p-8 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Request received</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  We'll email{" "}
                  <span className="font-medium text-foreground">
                    {formatGuestEmailsLabel({
                      guestEmail,
                      additionalGuestEmails,
                    })}
                  </span>{" "}
                  when your booking is approved, rescheduled, or cancelled.
                </p>
              </div>
              {selectedSlot && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateLabel(date)} · {formatSlotLabel(selectedSlot.startsAt)}
                  {confirmationId ? ` · Ref ${confirmationId.slice(0, 8)}` : ""}
                </div>
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
                  setAdditionalGuestEmails([]);
                }}
              >
                Book another call
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PortalPageWrap>
  );
}
