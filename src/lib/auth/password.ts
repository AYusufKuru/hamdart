import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import {
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/auth/password-rules";

const ROUNDS = 12;

export {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "@/lib/auth/password-rules";

/**
 * Şifreyi hash'ler. Politikaya uymayan şifre için hata atar — doğrulamanın
 * kazara atlanması mümkün olmasın diye burada da kontrol edilir.
 */
export async function hashPassword(
  password: string,
  context?: { username?: string; name?: string }
): Promise<string> {
  const problem = validatePassword(password, context);
  if (problem) throw new Error(problem);
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Kullanıcı kaydı yokken bile bcrypt çalıştırılır. Böylece yanıt süresinden
 * hesabın var olup olmadığı anlaşılamaz.
 *
 * Hash, "timing-placeholder-not-a-real-user" ifadesinin 12 tur bcrypt çıktısıdır
 * (gerçek bir hesaba ait değildir).
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$hqe.FZKfjXoC95fqYXb2Z.3.lHROvbqO10Qk3lIJEPqAmW47wyLAS";

export async function dummyVerifyPassword(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}

/** Kurulum ve şifre sıfırlama için politikaya uyan rastgele şifre üretir */
export function generatePassword(length = 16): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;

  const pick = (set: string) => set[randomInt(set.length)];

  // Her karakter sınıfından en az bir tane garanti edilir
  const chars = [pick(lower), pick(upper), pick(digits)];
  while (chars.length < Math.max(length, MIN_PASSWORD_LENGTH)) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
