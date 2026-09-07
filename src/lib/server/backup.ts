import { execFile } from "child_process";
import fs from "fs/promises";
import { promisify } from "util";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/server/audit";
import {
  getBackupDir,
  isSafeBackupFilename,
  resolveBackupPath,
  resolveOffsitePath,
} from "@/lib/server/backup-path";
import { FieldError } from "@/lib/server/fields";

const execFileAsync = promisify(execFile);

const FILE_ID_PREFIX = "file:";

type PgConn = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL ortam değişkeni tanımlı değil");
  }
  if (url.startsWith("file:")) {
    throw new Error(
      "SQLite yedekleme desteklenmiyor. PostgreSQL DATABASE_URL kullanın."
    );
  }
  return url;
}

function parsePgConnection(url: string): PgConn {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL geçersiz");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).split(
    "?"
  )[0];
  if (!parsed.hostname || !database) {
    throw new Error("DATABASE_URL geçersiz");
  }
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

/** pg_dump / pg_restore'a yalnızca bağlantı ve yol — oturum anahtarı aktarılmaz. */
export function buildPgChildEnv(url = getDatabaseUrl()): NodeJS.ProcessEnv {
  const conn = parsePgConnection(url);
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PATH: process.env.PATH ?? "",
    LANG: "C",
    LC_ALL: "C",
    TZ: process.env.TZ ?? "Europe/Istanbul",
    PGHOST: conn.host,
    PGPORT: conn.port,
    PGUSER: conn.user,
    PGPASSWORD: conn.password,
    PGDATABASE: conn.database,
  };
  for (const key of [
    "SYSTEMROOT",
    "WINDIR",
    "PATHEXT",
    "HOME",
    "USERPROFILE",
    "TMP",
    "TEMP",
    "ComSpec",
  ] as const) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

function sanitizePgError(err: unknown, fallback: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ENOENT|not found|is not recognized/i.test(raw)) {
    return new Error(
      `${fallback.split(":")[0]} aracı bulunamadı. PostgreSQL client araçlarının PATH'te olduğundan emin olun.`
    );
  }
  const redacted = raw
    .replace(/postgresql:\/\/[^\s"'\\]+/gi, "[redacted]")
    .replace(/postgres:\/\/[^\s"'\\]+/gi, "[redacted]")
    .replace(/PGPASSWORD=\S+/gi, "PGPASSWORD=[redacted]");
  console.error(fallback, redacted);
  return new Error(fallback);
}

async function ensureBackupDir(): Promise<string> {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function runPgDump(dest: string): Promise<void> {
  try {
    await execFileAsync(
      "pg_dump",
      ["-F", "c", "-f", dest, "--no-owner", "--no-acl"],
      { env: buildPgChildEnv() }
    );
  } catch (err) {
    throw sanitizePgError(err, "Yedek alınamadı");
  }
}

async function runPgRestore(backupPath: string): Promise<void> {
  const conn = parsePgConnection(getDatabaseUrl());
  try {
    await execFileAsync(
      "pg_restore",
      [
        "-d",
        conn.database,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        backupPath,
      ],
      { env: buildPgChildEnv() }
    );
  } catch (err) {
    throw sanitizePgError(err, "Geri yükleme başarısız");
  }
}

async function copyOffsite(src: string, filename: string): Promise<boolean> {
  const destDir = process.env.BACKUP_OFFSITE_DIR?.trim();
  if (!destDir) return false;
  try {
    await fs.mkdir(destDir, { recursive: true });
    const dest = resolveOffsitePath(destDir, filename);
    await fs.copyFile(src, dest);
    return true;
  } catch (err) {
    console.error(
      "Dış yedek kopyası yazılamadı:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

export type BackupInfo = {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  note: string | null;
};

function toInfo(row: {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: Date;
  createdBy: string;
  note: string | null;
}): BackupInfo {
  return {
    id: row.id,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    note: row.note,
  };
}

async function listDiskDumps(): Promise<
  { filename: string; sizeBytes: number; createdAt: Date }[]
> {
  const dir = getBackupDir();
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: { filename: string; sizeBytes: number; createdAt: Date }[] = [];
  for (const name of names) {
    if (!isSafeBackupFilename(name)) continue;
    try {
      const stat = await fs.stat(resolveBackupPath(name));
      if (!stat.isFile()) continue;
      out.push({
        filename: name,
        sizeBytes: stat.size,
        createdAt: stat.mtime,
      });
    } catch {
      // geçersiz / dışarı taşan ad
    }
  }
  return out;
}

export async function listBackups(): Promise<BackupInfo[]> {
  const rows = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
  });
  const known = new Set(
    rows.filter((r) => isSafeBackupFilename(r.filename)).map((r) => r.filename)
  );
  const fromDb = rows
    .filter((r) => isSafeBackupFilename(r.filename))
    .map(toInfo);
  const extras = (await listDiskDumps())
    .filter((f) => !known.has(f.filename))
    .map((f) => ({
      id: `${FILE_ID_PREFIX}${f.filename}`,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt.toISOString(),
      createdBy: "sistem",
      note: "Dosyadan tarandı",
    }));
  return [...fromDb, ...extras].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export async function createBackup(
  actor: string,
  note?: string
): Promise<BackupInfo> {
  await ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `hamdart-${stamp}.dump`;
  const dest = resolveBackupPath(filename);

  await runPgDump(dest);
  const stat = await fs.stat(dest);
  const offsiteCopied = await copyOffsite(dest, filename);

  const record = await prisma.backupRecord.create({
    data: {
      filename,
      filepath: dest,
      sizeBytes: stat.size,
      createdBy: actor,
      note: note?.trim() || null,
    },
  });

  await logAudit({
    actor,
    action: "BACKUP",
    entityType: "Backup",
    entityId: record.id,
    summary: `PostgreSQL yedeği oluşturuldu: ${filename}`,
    after: { filename, sizeBytes: stat.size, offsiteCopied },
  });

  return toInfo(record);
}

async function loadBackup(
  backupId: string
): Promise<{ id: string; filename: string; path: string }> {
  if (backupId.startsWith(FILE_ID_PREFIX)) {
    const filename = backupId.slice(FILE_ID_PREFIX.length);
    const dest = resolveBackupPath(filename);
    try {
      await fs.access(dest);
    } catch {
      throw new FieldError("Yedek dosyası diskte bulunamadı");
    }
    return { id: backupId, filename, path: dest };
  }

  const backup = await prisma.backupRecord.findUnique({
    where: { id: backupId },
  });
  if (!backup) {
    throw new FieldError("Yedek kaydı bulunamadı");
  }
  if (!isSafeBackupFilename(backup.filename)) {
    throw new FieldError("Yedek dosya adı geçersiz; geri yükleme iptal edildi");
  }
  const dest = resolveBackupPath(backup.filename);
  try {
    await fs.access(dest);
  } catch {
    throw new FieldError("Yedek dosyası diskte bulunamadı");
  }
  return { id: backup.id, filename: backup.filename, path: dest };
}

export async function restoreBackup(
  backupId: string,
  actor: string,
  confirmFilename: string
): Promise<void> {
  const backup = await loadBackup(backupId);
  if (confirmFilename.trim() !== backup.filename) {
    throw new FieldError(
      "Dosya adı eşleşmiyor. Geri yükleme iptal edildi."
    );
  }

  await createBackup(actor, "Geri yükleme öncesi otomatik güvenlik yedeği");
  await runPgRestore(backup.path);

  await logAudit({
    actor,
    action: "RESTORE",
    entityType: "Backup",
    entityId: backup.id,
    summary: `PostgreSQL geri yüklendi: ${backup.filename}`,
    after: { filename: backup.filename },
  });
}

export async function deleteBackup(
  backupId: string,
  actor: string
): Promise<void> {
  const backup = await loadBackup(backupId);
  try {
    await fs.unlink(backup.path);
  } catch {
    // Dosya zaten silinmiş olabilir
  }

  if (!backupId.startsWith(FILE_ID_PREFIX)) {
    await prisma.backupRecord.delete({ where: { id: backup.id } }).catch(() => {
      // kayıt yoksa sessiz
    });
  }

  await logAudit({
    actor,
    action: "DELETE",
    entityType: "Backup",
    entityId: backup.id,
    summary: `Yedek silindi: ${backup.filename}`,
    before: { filename: backup.filename },
  });
}
