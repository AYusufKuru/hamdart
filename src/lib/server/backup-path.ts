import path from "path";

/** Yalnızca ürettiğimiz dump adları — `..`, eğik çizgi ve sürücü harfi yok. */
export const BACKUP_FILENAME_RE = /^hamdart-[A-Za-z0-9._-]+\.dump$/;

export function getBackupDir(): string {
  const fromEnv = process.env.BACKUP_DIR?.trim();
  return path.resolve(fromEnv || path.join(process.cwd(), "backups"));
}

export function isSafeBackupFilename(filename: string): boolean {
  if (!BACKUP_FILENAME_RE.test(filename)) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  if (filename.includes("..")) return false;
  return true;
}

export function isPathInsideDir(dir: string, candidate: string): boolean {
  const root = path.resolve(dir);
  const target = path.resolve(candidate);
  const rel = path.relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Dosya adını BACKUP_DIR altına çözer.
 * Veritabanındaki `filepath` alanına güvenilmez; her zaman ad üzerinden üretilir.
 */
export function resolveBackupPath(filename: string): string {
  if (!isSafeBackupFilename(filename)) {
    throw new Error("Geçersiz yedek dosya adı");
  }
  const dir = getBackupDir();
  const resolved = path.resolve(dir, filename);
  if (!isPathInsideDir(dir, resolved)) {
    throw new Error("Yedek dosya yolu izin verilen klasörün dışında");
  }
  return resolved;
}

export function resolveOffsitePath(
  offsiteDir: string,
  filename: string
): string {
  if (!isSafeBackupFilename(filename)) {
    throw new Error("Geçersiz yedek dosya adı");
  }
  const dir = path.resolve(offsiteDir);
  const resolved = path.resolve(dir, filename);
  if (!isPathInsideDir(dir, resolved)) {
    throw new Error("Dış kopya yolu izin verilen klasörün dışında");
  }
  return resolved;
}
