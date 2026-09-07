/**
 * Şifre politikası — sunucu ve istemci tarafında ortak kullanılır.
 * Bu dosya bilinçli olarak Node.js'e özgü bağımlılık içermez (bcrypt, crypto);
 * böylece istemci bileşenlerinden de import edilebilir.
 */

export const MIN_PASSWORD_LENGTH = 12;
/** bcrypt yalnızca ilk 72 baytı kullanır; daha uzun şifreler sessizce kırpılır */
export const MAX_PASSWORD_BYTES = 72;

/** Kullanıcıya gösterilecek kural özeti */
export const PASSWORD_RULES_TEXT = `En az ${MIN_PASSWORD_LENGTH} karakter; küçük harf, büyük harf ve rakam içermeli.`;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "sifre123456",
  "parola123456",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "qwerty123456",
  "admin1234567",
  "administrator",
  "hamdart12345",
  "hamdpharma12",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Şifreyi politikaya göre denetler.
 * @returns Kural ihlali varsa Türkçe hata mesajı, şifre uygunsa null.
 */
export function validatePassword(
  password: string,
  context?: { username?: string; name?: string }
): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Şifre zorunludur.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
  }
  if (byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Şifre çok uzun (en fazla ${MAX_PASSWORD_BYTES} bayt). Lütfen daha kısa bir şifre seçin.`;
  }
  if (password !== password.trim()) {
    return "Şifre boşlukla başlayamaz veya bitemez.";
  }
  if (!/[a-zçğıöşü]/.test(password)) {
    return "Şifre en az bir küçük harf içermelidir.";
  }
  if (!/[A-ZÇĞIİÖŞÜ]/.test(password)) {
    return "Şifre en az bir büyük harf içermelidir.";
  }
  if (!/[0-9]/.test(password)) {
    return "Şifre en az bir rakam içermelidir.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "Şifre aynı karakterin tekrarından oluşamaz.";
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    return "Bu şifre çok yaygın kullanılıyor. Lütfen başka bir şifre seçin.";
  }

  const username = context?.username?.trim().toLowerCase();
  if (username && username.length >= 3 && lowered.includes(username)) {
    return "Şifre kullanıcı adını içeremez.";
  }

  if (context?.name) {
    for (const part of context.name.toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && lowered.includes(part)) {
        return "Şifre adınızı veya soyadınızı içeremez.";
      }
    }
  }

  return null;
}
