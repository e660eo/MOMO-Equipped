import crypto from "node:crypto";

/*
  Хеширование паролей на сервере — одно на всех: и владелец панели, и
  покупатели. Пароль не хранится нигде: только scrypt-хеш со случайной солью.

  Разделитель — двоеточие: значения из .env проходят подстановку переменных,
  и «$» внутри хеша съедался бы как ссылка на другую переменную.
*/

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = (stored ?? "").split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  // Сравнение постоянного времени: обычное === подсказывало бы подбирающему,
  // сколько первых байт он уже угадал.
  return crypto.timingSafeEqual(expected, actual);
}
