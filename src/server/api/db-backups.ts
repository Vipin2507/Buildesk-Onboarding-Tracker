import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { resolveDbPath } from "@/server/db/client";
import {
  createDbBackupFile,
  DB_BACKUP_RETENTION,
  deleteDbBackupFile,
  listDbBackupFiles,
  resolveBackupsDir,
} from "@/server/lib/db-backup-storage";

export const getDbBackupStatus = createServerFn({ method: "GET" }).handler(async () => {
  requireUser(["Admin"]);
  const backups = listDbBackupFiles();
  return {
    liveDbPath: resolveDbPath(),
    backupsDir: resolveBackupsDir(),
    retention: DB_BACKUP_RETENTION,
    backupCount: backups.length,
    latest: backups[0] ?? null,
  };
});

export const listDbBackups = createServerFn({ method: "GET" }).handler(async () => {
  requireUser(["Admin"]);
  return listDbBackupFiles();
});

export const createDbBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ kind: z.enum(["auto", "manual"]).optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    return createDbBackupFile({ kind: data?.kind ?? "manual" });
  });

export const deleteDbBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ filename: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    requireUser(["Admin"]);
    return deleteDbBackupFile(data.filename);
  });
