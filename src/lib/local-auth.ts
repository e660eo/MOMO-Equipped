/*
  Хеширование пароля для ЛОКАЛЬНОГО аккаунта (до серверной Фазы 3).

  Пароль никуда не отправляется и нигде не хранится в открытом виде:
  в localStorage кладётся только необратимый PBKDF2-SHA256-хеш со случайной
  солью. Восстановить пароль из него нельзя — поэтому и «восстановления
  пароля» у локального аккаунта нет, только удалить и создать заново.

  Web Crypto доступен лишь в защищённом контексте (https или localhost) —
  ещё одна причина, по которой боевой сайт обязан работать по HTTPS.
*/

const ITERATIONS = 200_000;

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Вход работает только по HTTPS (или на localhost) — откройте сайт по защищённому адресу.",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toB64(new Uint8Array(bits));
}

/** Хеш нового пароля со свежей случайной солью. */
export async function hashPassword(
  password: string,
): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: await derive(password, salt) };
}

/** Проверка пароля против сохранённых соли и хеша. */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  return (await derive(password, fromB64(salt))) === hash;
}
