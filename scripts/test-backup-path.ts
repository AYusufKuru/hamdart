/**
 * Adım 11 — yol kaçışı ve dosya adı. Prisma yüklemez.
 */
import path from "node:path";
import {
  isPathInsideDir,
  isSafeBackupFilename,
  resolveBackupPath,
  resolveOffsitePath,
} from "../src/lib/server/backup-path";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  GECTI  ${label}`);
  } else {
    fail++;
    console.log(`  BASARISIZ  ${label}`);
    if (detail !== undefined) console.log(`         gelen: ${JSON.stringify(detail)}`);
  }
}

function throws(label: string, fn: () => void) {
  try {
    fn();
    check(label, false, "hata bekleniyordu");
  } catch {
    check(label, true);
  }
}

console.log("Yedek yol birim testleri\n");

check("gecerli ad", isSafeBackupFilename("hamdart-2026-09-07_030015.dump"));
check("iso benzeri ad", isSafeBackupFilename("hamdart-2026-09-07T20-57-12-345Z.dump"));
check(".. reddedilir", !isSafeBackupFilename("hamdart-..dump"));
check("slash reddedilir", !isSafeBackupFilename("hamdart-a/b.dump"));
check("backslash reddedilir", !isSafeBackupFilename("hamdart-a\\b.dump"));
check("baska uzanti reddedilir", !isSafeBackupFilename("hamdart-2026.dump.bak"));
check("on eksiz reddedilir", !isSafeBackupFilename("other-2026-09-07.dump"));

const prev = process.env.BACKUP_DIR;
const tmpRoot = path.resolve("backups-test-step11");
process.env.BACKUP_DIR = tmpRoot;

const ok = resolveBackupPath("hamdart-2026-09-07_030015.dump");
check(
  "cozum BACKUP_DIR altinda",
  isPathInsideDir(tmpRoot, ok) && path.basename(ok) === "hamdart-2026-09-07_030015.dump",
  ok
);

throws(".. dosya adi", () => resolveBackupPath("../hamdart-x.dump"));
throws("mutlak yol adi", () =>
  resolveBackupPath("C:\\Windows\\hamdart-x.dump")
);
throws("unix kacisi", () => resolveBackupPath("../../etc/passwd.dump"));

const outside = path.resolve(tmpRoot, "..", "escape.dump");
check("klasor disi yol reddedilir", !isPathInsideDir(tmpRoot, outside), outside);

const offsite = resolveOffsitePath(path.join(tmpRoot, "offsite"), "hamdart-ok.dump");
check(
  "dis kopya hedefi klasor icinde",
  isPathInsideDir(path.resolve(tmpRoot, "offsite"), offsite)
);
throws("dis kopya kacisi", () =>
  resolveOffsitePath(path.join(tmpRoot, "offsite"), "../hamdart-x.dump")
);

if (prev === undefined) delete process.env.BACKUP_DIR;
else process.env.BACKUP_DIR = prev;

console.log(`\nYol testleri: ${pass} gecti, ${fail} basarisiz`);
if (fail) process.exit(1);
