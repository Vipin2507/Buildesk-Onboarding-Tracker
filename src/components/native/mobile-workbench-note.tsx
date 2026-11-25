import { useEffect, useState } from "react";

const NOTES: { prefix: string; title: string; detail: string }[] = [
  {
    prefix: "/admin",
    title: "Command Center is easier on a large screen",
    detail:
      "You can still open it. Wide tables scroll sideways. Counts come from the server, the same as on desktop.",
  },
  {
    prefix: "/reports",
    title: "Reports are easier on a large screen",
    detail:
      "The chart stays available. Scroll the table sideways for every column. Downloads still come from the server.",
  },
  {
    prefix: "/automation",
    title: "Automation is an admin workspace",
    detail: "Switches still save to the server. Wide rule tables scroll sideways.",
  },
  {
    prefix: "/crm/automation",
    title: "Automation is an admin workspace",
    detail: "Switches still save to the server. Wide rule tables scroll sideways.",
  },
  {
    prefix: "/master",
    title: "Master catalogs are easier on a large screen",
    detail: "You can still edit them. Changes save to the server when you submit.",
  },
  {
    prefix: "/crm/master",
    title: "Master catalogs are easier on a large screen",
    detail: "You can still edit them. Changes save to the server when you submit.",
  },
  {
    prefix: "/crm/usage",
    title: "Usage is a dense board",
    detail: "Saved days and account cards work here. Wide day grids scroll sideways.",
  },
  {
    prefix: "/crm/broadcasts",
    title: "Broadcasts are easier on a large screen",
    detail: "You can still compose and send. Group pickers scroll sideways.",
  },
  {
    prefix: "/crm/win-back",
    title: "Win-back is easier on a large screen",
    detail: "Import, campaigns, and delivery activity stay available. Wide tables scroll sideways.",
  },
  {
    prefix: "/dpr/tracker",
    title: "DPR Tracker is a manager grid",
    detail: "Search still works. The compliance table scrolls sideways.",
  },
];

const STORAGE_KEY = "buildesk.mobileWorkbench.dismissed";

function matchNote(pathname: string) {
  return (
    NOTES.find((note) => pathname === note.prefix || pathname.startsWith(`${note.prefix}/`)) ?? null
  );
}

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function MobileWorkbenchNote({ pathname }: { pathname: string }) {
  const note = matchNote(pathname);
  const [narrow, setNarrow] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(media.matches);
    sync();
    setDismissed(readDismissed());
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!note || !narrow || dismissed.includes(note.prefix)) return null;

  return (
    <div className="border-b bg-secondary/70 px-3 py-2 text-secondary-foreground md:hidden">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{note.title}</p>
          <p className="mt-0.5 text-sm leading-snug text-secondary-foreground/80">{note.detail}</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-sm font-semibold"
          onClick={() => {
            const next = [...dismissed, note.prefix];
            setDismissed(next);
            try {
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
              /* ignore */
            }
          }}
        >
          Hide
        </button>
      </div>
    </div>
  );
}
