import crypto from "node:crypto";
import { SITE_URL } from "./site-url";
import { assertWritable, readJson, writeJson } from "./store";

/*
  OAuth 2.0 для Ozon Доставки.

  Client secret живёт только в окружении сервера. Полученные access/refresh
  tokens дополнительно шифруются этим secret перед записью в папку данных:
  утечки одного MOMO_DATA_DIR недостаточно, чтобы получить доступ к Ozon.
*/

const TOKEN_URL = "https://xapi.ozon.ru/oauth/token";
const AUTHORIZE_URL = "https://seller.ozon.ru/app/appstore/oauth/authorize";
const TOKEN_FILE = "ozon-oauth.json";
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_AHEAD_MS = 2 * 60 * 1000;

export const OZON_DELIVERY_SCOPE = "seller-api.ozon-logistics";
export const OZON_OAUTH_CALLBACK = `${SITE_URL}/api/ozon/oauth/callback`;

interface OzonOAuthConfig {
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number | string;
  scope?: string | string[];
  error?: string;
  error_description?: string;
  message?: string;
}

interface OzonTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  scope?: string;
}

interface SealedTokens {
  version: 1;
  iv: string;
  tag: string;
  payload: string;
  updatedAt: string;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function ozonOAuthConfig(): OzonOAuthConfig | null {
  const clientId = env("OZON_OAUTH_CLIENT_ID");
  const clientSecret = env("OZON_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isOzonOAuthConfigured(): boolean {
  return ozonOAuthConfig() !== null;
}

function requireConfig(): OzonOAuthConfig {
  const config = ozonOAuthConfig();
  if (!config) throw new Error("OAuth Ozon не настроен на сервере.");
  return config;
}

function stateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`ozon-oauth:${payload}`)
    .digest("base64url");
}

/** Короткоживущая подпись защищает callback от подмены чужим OAuth-кодом. */
export function createOzonOAuthState(): string {
  const { clientSecret } = requireConfig();
  const payload = `${Date.now() + STATE_TTL_MS}.${crypto.randomBytes(18).toString("base64url")}`;
  return `${payload}.${stateSignature(payload, clientSecret)}`;
}

export function verifyOzonOAuthState(state: string): boolean {
  const { clientSecret } = requireConfig();
  const parts = state.split(".");
  if (parts.length !== 3) return false;

  const [expires, nonce, signature] = parts;
  if (!/^\d+$/.test(expires) || !nonce || Number(expires) < Date.now()) return false;

  const expected = Buffer.from(stateSignature(`${expires}.${nonce}`, clientSecret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createOzonAuthorizeUrl(): string {
  const { clientId } = requireConfig();
  const query = new URLSearchParams({
    client_id: clientId,
    scope: OZON_DELIVERY_SCOPE,
    redirect_uri: OZON_OAUTH_CALLBACK,
    response_type: "code",
    access_type: "offline",
    state: createOzonOAuthState(),
    // Если в Ozon ID несколько компаний, Ozon покажет выбор и не выдаст
    // токен случайно открытому в кабинете магазину.
    prompt: "select_company",
  });
  return `${AUTHORIZE_URL}?${query.toString()}`;
}

function encryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`momo-ozon:${secret}`).digest();
}

function sealTokens(tokens: OzonTokens, secret: string): SealedTokens {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    payload: payload.toString("base64url"),
    updatedAt: new Date().toISOString(),
  };
}

function openTokens(sealed: SealedTokens, secret: string): OzonTokens {
  if (sealed.version !== 1) throw new Error("Неизвестная версия OAuth-данных Ozon.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(sealed.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64url"));
  const raw = Buffer.concat([
    decipher.update(Buffer.from(sealed.payload, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(raw) as OzonTokens;
}

function loadTokens(): OzonTokens | null {
  const config = ozonOAuthConfig();
  if (!config) return null;
  try {
    return openTokens(readJson<SealedTokens>(TOKEN_FILE), config.clientSecret);
  } catch {
    return null;
  }
}

function saveTokens(tokens: OzonTokens): void {
  const { clientSecret } = requireConfig();
  assertWritable();
  writeJson(TOKEN_FILE, sealTokens(tokens, clientSecret));
}

async function requestTokens(
  params: Record<string, string>,
  previousRefreshToken?: string,
): Promise<OzonTokens> {
  const { clientId, clientSecret } = requireConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "momo-eq.ru Ozon Delivery integration",
    },
    body: JSON.stringify({
      ...params,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !body.access_token) {
    const detail =
      body.error_description || body.message || body.error || `HTTP ${response.status}`;
    throw new Error(`Ozon не выдал OAuth-токен: ${detail}`);
  }

  const expiresIn = Number(body.expires_in);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || previousRefreshToken,
    tokenType: body.token_type || "Bearer",
    // Если срок не пришёл, берём безопасный короткий час и обновим заранее.
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    ...(body.scope
      ? { scope: Array.isArray(body.scope) ? body.scope.join(" ") : body.scope }
      : {}),
  };
}

export async function exchangeOzonAuthorizationCode(code: string): Promise<void> {
  const tokens = await requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: OZON_OAUTH_CALLBACK,
  });
  saveTokens(tokens);
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(current: OzonTokens): Promise<string> {
  if (!current.refreshToken) {
    throw new Error("Ozon не выдал refresh token — требуется повторная авторизация.");
  }
  const tokens = await requestTokens(
    { grant_type: "refresh_token", refresh_token: current.refreshToken },
    current.refreshToken,
  );
  saveTokens(tokens);
  return tokens.accessToken;
}

/** Действующий Bearer-токен; при необходимости обновляется ровно одним запросом. */
export async function getOzonAccessToken(): Promise<string> {
  const current = loadTokens();
  if (!current) throw new Error("Магазин ещё не авторизован в Ozon.");
  if (current.expiresAt - REFRESH_AHEAD_MS > Date.now()) return current.accessToken;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(current).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export function hasOzonTokens(): boolean {
  return loadTokens() !== null;
}
