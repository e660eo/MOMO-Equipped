import crypto from "node:crypto";
import { getOzonAccessToken, hasOzonTokens, refreshOzonAccessToken } from "./ozon-auth";
import { assertWritable, readJson, writeJson } from "./store";

const API = "https://api-seller.ozon.ru";
const STOCK_CACHE_MS = 130_000;
const CREDENTIALS_FILE = "ozon-seller.json";

type OzonAuthMode = "api_key" | "oauth" | "missing";

export interface OzonStockLine {
  slug: string;
  title: string;
  offerId?: string;
  stock?: number;
  inStock?: boolean;
  quantity: number;
}

export interface OzonStockRow {
  offer_id: string;
  product_id: number;
  stock: number;
  warehouse_id: number;
}

export interface OzonStockSyncStatus {
  configured: boolean;
  authMode: OzonAuthMode;
  credentialSource: "environment" | "encrypted_file" | "oauth" | "missing";
  canSaveInAdmin: boolean;
  warehouseId?: number;
  warehouseMode: "fixed" | "automatic";
}

interface StoredCredentials {
  version: 1;
  iv: string;
  tag: string;
  payload: string;
}

interface ApiError {
  message?: string;
  error?: string;
  details?: Array<{ message?: string }>;
}

interface WarehouseRecord {
  warehouse_id?: number;
  id?: number;
  name?: string;
  status?: string;
  is_rfbs?: boolean;
  is_archived?: boolean;
  is_enabled?: boolean;
  pause_at?: string;
}

interface WarehouseListResponse {
  warehouses?: WarehouseRecord[];
  result?: WarehouseRecord[] | { warehouses?: WarehouseRecord[] };
}

interface StockUpdateResult {
  offer_id?: string;
  updated?: boolean;
  errors?: Array<{ code?: string; message?: string }>;
}

interface StockUpdateResponse {
  result?: StockUpdateResult[];
}

interface CachedStock {
  stock: number;
  at: number;
}

const recentStocks = new Map<string, CachedStock>();
let discoveredWarehouseId: number | undefined;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function environmentCredentials(): { clientId: string; apiKey: string } | null {
  const clientId = env("OZON_SELLER_CLIENT_ID");
  const apiKey = env("OZON_SELLER_API_KEY");
  return clientId && apiKey ? { clientId, apiKey } : null;
}

function credentialsEncryptionSecret(): string {
  return env("ADMIN_SESSION_SECRET");
}

function credentialsEncryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`momo-ozon-seller:${secret}`).digest();
}

function sealCredentials(
  credentials: { clientId: string; apiKey: string },
  secret: string,
): StoredCredentials {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", credentialsEncryptionKey(secret), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    payload: payload.toString("base64url"),
  };
}

function openCredentials(stored: StoredCredentials, secret: string): {
  clientId: string;
  apiKey: string;
} {
  if (stored.version !== 1) throw new Error("Неизвестная версия ключа Ozon.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    credentialsEncryptionKey(secret),
    Buffer.from(stored.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "base64url"));
  const raw = Buffer.concat([
    decipher.update(Buffer.from(stored.payload, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(raw) as { clientId: string; apiKey: string };
}

function storedCredentials(): { clientId: string; apiKey: string } | null {
  const secret = credentialsEncryptionSecret();
  if (!secret) return null;
  try {
    const credentials = openCredentials(readJson<StoredCredentials>(CREDENTIALS_FILE), secret);
    return validateOzonSellerCredentials(credentials.clientId, credentials.apiKey);
  } catch {
    return null;
  }
}

function sellerApiCredentials(): { clientId: string; apiKey: string } | null {
  return environmentCredentials() ?? storedCredentials();
}

export function validateOzonSellerCredentials(
  rawClientId: string,
  rawApiKey: string,
): { clientId: string; apiKey: string } {
  const clientId = rawClientId.trim();
  const apiKey = rawApiKey.trim();
  if (!/^\d{3,30}$/.test(clientId)) {
    throw new Error("Client ID должен состоять из цифр. Скопируйте его из раздела Seller API.");
  }
  if (apiKey.length < 20 || apiKey.length > 300 || /[\r\n]/.test(apiKey)) {
    throw new Error("API Key выглядит некорректно. Скопируйте ключ целиком из Ozon Seller.");
  }
  return { clientId, apiKey };
}

export function saveOzonSellerCredentials(rawClientId: string, rawApiKey: string): void {
  const secret = credentialsEncryptionSecret();
  if (!secret) {
    throw new Error("На сервере не настроен секрет шифрования ADMIN_SESSION_SECRET.");
  }
  const credentials = validateOzonSellerCredentials(rawClientId, rawApiKey);
  assertWritable();
  writeJson(CREDENTIALS_FILE, sealCredentials(credentials, secret));
}

function configuredWarehouseId(): number | undefined {
  const value = Number(env("OZON_FBS_WAREHOUSE_ID"));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function authMode(): OzonAuthMode {
  if (sellerApiCredentials()) return "api_key";
  return hasOzonTokens() ? "oauth" : "missing";
}

export function getOzonStockSyncStatus(): OzonStockSyncStatus {
  const warehouseId = configuredWarehouseId();
  const mode = authMode();
  const source = environmentCredentials()
    ? "environment"
    : storedCredentials()
      ? "encrypted_file"
      : mode === "oauth"
        ? "oauth"
        : "missing";
  return {
    configured: mode !== "missing",
    authMode: mode,
    credentialSource: source,
    canSaveInAdmin: Boolean(credentialsEncryptionSecret()),
    ...(warehouseId ? { warehouseId } : {}),
    warehouseMode: warehouseId ? "fixed" : "automatic",
  };
}

function errorDetail(body: ApiError, status: number): string {
  return (
    body.message ||
    body.error ||
    body.details?.find((detail) => detail.message)?.message ||
    `HTTP ${status}`
  );
}

async function sellerPost<T>(path: string, payload: unknown): Promise<T> {
  const credentials = sellerApiCredentials();
  const request = (token?: string) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        ...(credentials
          ? { "Client-Id": credentials.clientId, "Api-Key": credentials.apiKey }
          : token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        "Content-Type": "application/json",
        "User-Agent": "momo-eq.ru Ozon stock integration",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

  if (!credentials && !hasOzonTokens()) {
    throw new Error("Автоматические остатки Ozon не подключены.");
  }

  let response = credentials
    ? await request()
    : await request(await getOzonAccessToken());
  if (!credentials && response.status === 401) {
    response = await request(await refreshOzonAccessToken());
  }

  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(`Ozon Остатки: ${errorDetail(body, response.status)}`);
  }
  return body;
}

function warehouseRecords(body: WarehouseListResponse): WarehouseRecord[] {
  if (Array.isArray(body.warehouses)) return body.warehouses;
  if (Array.isArray(body.result)) return body.result;
  return body.result?.warehouses ?? [];
}

function activeFbsWarehouses(body: WarehouseListResponse): Array<WarehouseRecord & { id: number }> {
  return warehouseRecords(body)
    .map((warehouse) => ({ ...warehouse, id: Number(warehouse.warehouse_id ?? warehouse.id) }))
    .filter((warehouse): warehouse is WarehouseRecord & { id: number } => {
      const status = warehouse.status?.toUpperCase() ?? "";
      return (
        Number.isSafeInteger(warehouse.id) &&
        warehouse.id > 0 &&
        warehouse.is_rfbs !== true &&
        warehouse.is_archived !== true &&
        warehouse.is_enabled !== false &&
        !status.includes("ARCHIV") &&
        !status.includes("DISABLED") &&
        !status.includes("INACTIVE")
      );
    });
}

async function resolveWarehouseId(): Promise<number> {
  const fixed = configuredWarehouseId();
  if (fixed) return fixed;
  if (discoveredWarehouseId) return discoveredWarehouseId;

  const body = await sellerPost<WarehouseListResponse>("/v2/warehouse/list", {});
  const warehouses = activeFbsWarehouses(body);
  if (warehouses.length === 1) {
    discoveredWarehouseId = warehouses[0].id;
    return discoveredWarehouseId;
  }
  if (warehouses.length === 0) {
    throw new Error("В Ozon не найден активный склад FBS для отправки товаров MOMO.");
  }
  throw new Error(
    "В Ozon найдено несколько складов FBS. Укажите склад MOMO в настройке OZON_FBS_WAREHOUSE_ID.",
  );
}

export function buildOzonStockRows(
  lines: OzonStockLine[],
  warehouseId: number,
): OzonStockRow[] {
  if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    throw new Error("Не указан корректный склад Ozon FBS.");
  }
  return lines.map((line) => {
    if (!line.offerId) {
      throw new Error(
        `Для «${line.title}» не указан артикул Ozon. Добавьте его в карточке товара в админке.`,
      );
    }
    const publishedStock = Number.isSafeInteger(line.stock)
      ? line.stock!
      : line.inStock === true
        // В старом каталоге учитывается только флажок наличия. Не публикуем
        // условные 99 штук: открываем ровно то количество, которое сейчас
        // нужно покупателю для расчёта доставки.
        ? line.quantity
        : undefined;
    if (publishedStock === undefined || publishedStock < 0) {
      throw new Error(
        `Для «${line.title}» не подтверждено наличие на складе MOMO. Укажите остаток или включите «В наличии» в карточке товара.`,
      );
    }
    if (publishedStock < line.quantity) {
      throw new Error(
        `На складе MOMO недостаточно товара «${line.title}»: доступно ${publishedStock}.`,
      );
    }
    return {
      offer_id: line.offerId,
      product_id: 0,
      stock: publishedStock,
      warehouse_id: warehouseId,
    };
  });
}

function cacheKey(row: OzonStockRow): string {
  return `${row.warehouse_id}:${row.offer_id}`;
}

function shouldSend(row: OzonStockRow, now: number): boolean {
  const cached = recentStocks.get(cacheKey(row));
  return !cached || cached.stock !== row.stock || now - cached.at >= STOCK_CACHE_MS;
}

function updateError(result: StockUpdateResult): string {
  return (result.errors ?? [])
    .map((error) => error.message || error.code)
    .filter(Boolean)
    .join("; ");
}

function isRateLimitMessage(message: string): boolean {
  return /too frequently|too many requests|rate limit|слишком часто/i.test(message);
}

export async function syncOzonStocks(lines: OzonStockLine[]): Promise<{
  configured: boolean;
  updated: number;
  skipped: number;
  warehouseId?: number;
}> {
  if (authMode() === "missing") {
    return { configured: false, updated: 0, skipped: 0 };
  }

  const warehouseId = await resolveWarehouseId();
  const rows = buildOzonStockRows(lines, warehouseId);
  const now = Date.now();
  const pending = rows.filter((row) => shouldSend(row, now));
  if (!pending.length) {
    return { configured: true, updated: 0, skipped: rows.length, warehouseId };
  }

  const body = await sellerPost<StockUpdateResponse>("/v2/products/stocks", {
    stocks: pending,
  });
  const results = body.result ?? [];
  let updated = 0;
  const failures: string[] = [];

  pending.forEach((row, index) => {
    const result = results.find((item) => item.offer_id === row.offer_id) ?? results[index];
    const detail = result ? updateError(result) : "Ozon не вернул результат обновления";
    if (result?.updated === true && !detail) {
      recentStocks.set(cacheKey(row), { stock: row.stock, at: now });
      updated += 1;
      return;
    }
    // После обновления из другого процесса Ozon запрещает повтор в течение
    // двух минут. Расчёт маршрута всё равно повторяем: нужный остаток уже мог
    // успеть примениться на стороне Ozon.
    if (detail && isRateLimitMessage(detail)) return;
    failures.push(`${row.offer_id}: ${detail || "остаток не обновлён"}`);
  });

  if (failures.length) {
    throw new Error(`Ozon не принял остаток: ${failures.join("; ")}.`);
  }
  return {
    configured: true,
    updated,
    skipped: rows.length - pending.length,
    warehouseId,
  };
}
