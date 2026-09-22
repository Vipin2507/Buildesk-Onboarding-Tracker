import { createDbBackupFile, listDbBackupFiles } from "@/server/lib/db-backup-storage";

/** Run automatic backups about once per day while the server process is up. */
const INTERVAL_MS = 24 * 60 * 60 * 1000;
/** First auto backup shortly after boot so a fresh deploy still has a snapshot. */
const FIRST_DELAY_MS = 45_000;
/** Skip creating another auto backup if one already exists from the last N hours. */
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

let started = false;

function latestAutoBackupAgeMs() {
  const latest = listDbBackupFiles().find((b) => b.kind === "auto");
  if (!latest) return Number.POSITIVE_INFINITY;
  return Date.now() - new Date(latest.createdAt).getTime();
}

async function runAutoBackup(reason: string) {
  try {
    if (latestAutoBackupAgeMs() < MIN_GAP_MS) {
      console.log(`[db-backup-scheduler] skip (${reason}) — recent auto backup exists`);
      return;
    }
    const backup = await createDbBackupFile({ kind: "auto" });
    console.log(
      `[db-backup-scheduler] created ${backup.filename} (${backup.sizeBytes} bytes) via ${reason}`,
    );
  } catch (err) {
    console.warn("[db-backup-scheduler]", err);
  }
}

/** Daily whole-database snapshots stored under data/backups (next to the live SQLite file). */
export function startDbBackupScheduler() {
  if (started) return;
  started = true;

  console.log("[db-backup-scheduler] started (daily interval)");

  setTimeout(() => void runAutoBackup("startup"), FIRST_DELAY_MS);
  setInterval(() => void runAutoBackup("interval"), INTERVAL_MS);
}
