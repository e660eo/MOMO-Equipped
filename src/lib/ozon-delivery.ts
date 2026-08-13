import crypto from "node:crypto";
import { getProducts, siteConfig } from "./data";
import { getOzonAccessToken, refreshOzonAccessToken } from "./ozon-auth";
import type {
  Order,
  OrderDelivery,
  OrderItem,
  OzonDeliverySplit,
} from "./types";

const API = "https://api-seller.ozon.ru";
const MAX_POINT_DETAILS = 100;
const SELECTION_TTL_MS = 30 * 60 * 1000;

interface ApiError {
  message?: string;
  error?: string;
  details?: Array<{ message?: string }>;
}

interface PointMapResponse {
  clusters?: Array<{
    coordinate?: { lat?: number; long?: number };
    map_point_ids?: string[];
    points_count?: number;
    viewport?: {
      left_bottom?: { lat?: number; long?: number };
      right_top?: { lat?: number; long?: number };
    };
  }>;
}

interface PointInfoResponse {
  points?: Array<{
    enabled?: boolean;
    delivery_method?: {
      map_point_id?: number;
      name?: string;
      address?: string;
      coordinates?: { lat?: number; long?: number };
    };
  }>;
}

interface CheckoutResponse {
  splits?: Array<{
    delivery_schema?: "FBO" | "FBS" | "UNSPECIFIED";
    warehouse_id?: number;
    unavailable_reason?: string;
    items?: Array<{ sku?: number; offer_id?: string; quantity?: number }>;
    delivery_method?: {
      id?: number;
      delivery_type?: "PVZ" | "POSTAMAT" | "COURIER" | "UNSPECIFIED";
      unavailable_reason?: string;
      timeslots?: Array<{
        timeslot_id?: number;
        logistic_date_range?: { from?: string; to?: string };
      }>;
    };
  }>;
}

interface OrderCreateResponse {
  order_number?: string;
  postings?: string[];
}

export interface PublicOzonPoint {
  id: number;
  name: string;
  address: string;
  lat: number;
  long: number;
  distanceKm: number;
}

export interface OzonMapViewport {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface PublicOzonCluster {
  id: string;
  lat: number;
  long: number;
  pointsCount: number;
  viewport: OzonMapViewport;
}

export interface OzonMapArea {
  points: PublicOzonPoint[];
  clusters: PublicOzonCluster[];
}

export interface OzonDeliverySelection {
  provider: "ozon";
  type: "pickup";
  point: PublicOzonPoint;
  estimatedFrom?: string;
  estimatedTo?: string;
  customerPrice: number;
  token: string;
}

interface CatalogLine {
  slug: string;
  sku: number;
  offerId?: string;
  quantity: number;
  price: number;
}

interface StoredSelection {
  expiresAt: number;
  phone: string;
  point: PublicOzonPoint;
  lines: CatalogLine[];
  customerPrice: number;
  splits: OzonDeliverySplit[];
  estimatedFrom?: string;
  estimatedTo?: string;
}

const selections = new Map<string, StoredSelection>();
const OZON_DELIVERY_THRESHOLD = siteConfig.trust.freeShippingFrom;
export const OZON_DELIVERY_SURCHARGE = 300;

function cleanPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^8/, "7");
  return digits.startsWith("7") ? digits : `7${digits}`;
}

function errorDetail(body: ApiError, status: number): string {
  return (
    body.message ||
    body.error ||
    body.details?.find((detail) => detail.message)?.message ||
    `HTTP ${status}`
  );
}

async function ozonPost<T>(path: string, payload: unknown): Promise<T> {
  const request = (token: string) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "momo-eq.ru Ozon Delivery integration",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

  let response = await request(await getOzonAccessToken());
  if (response.status === 401) {
    // Срок в OAuth-ответе иногда расходится с фактическим сроком JWT Ozon.
    // Обновляем токен по факту 401 и ровно один раз повторяем исходный запрос.
    response = await request(await refreshOzonAccessToken());
  }

  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(`Ozon Доставка: ${errorDetail(body, response.status)}`);
  }
  return body;
}

function haversine(lat1: number, long1: number, lat2: number, long2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLong = toRad(long2 - long1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLong / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function officialPoint(pointId: number): Promise<PublicOzonPoint> {
  if (!Number.isInteger(pointId) || pointId <= 0) {
    throw new Error("Выберите корректный пункт Ozon.");
  }
  const body = await ozonPost<PointInfoResponse>("/v1/delivery/point/info", {
    map_point_ids: [String(pointId)],
  });
  const point = body.points?.find(
    (item) => item.enabled && item.delivery_method?.map_point_id === pointId,
  );
  const method = point?.delivery_method;
  const lat = Number(method?.coordinates?.lat);
  const long = Number(method?.coordinates?.long);
  if (!method || !Number.isFinite(lat) || !Number.isFinite(long)) {
    throw new Error("Этот пункт Ozon сейчас недоступен — выберите другой.");
  }
  return {
    id: pointId,
    name: method.name || "Пункт Ozon",
    address: method.address || "Адрес уточняется в Ozon",
    lat,
    long,
    distanceKm: 0,
  };
}

function validViewport(viewport: OzonMapViewport): OzonMapViewport {
  const south = Number(viewport.south);
  const west = Number(viewport.west);
  const north = Number(viewport.north);
  const east = Number(viewport.east);
  if (
    ![south, west, north, east].every(Number.isFinite) ||
    south >= north ||
    west >= east
  ) {
    throw new Error("Не удалось определить видимую область карты.");
  }
  return {
    south: Math.max(-85, south),
    west: Math.max(-180, west),
    north: Math.min(85, north),
    east: Math.min(180, east),
  };
}

/**
 * Данные для интерактивной карты из официального /v1/delivery/map.
 * На общем масштабе возвращаем кластеры, а подробности ПВЗ запрашиваем только
 * для одиночных точек в видимой области — так карта охватывает всю Россию и
 * не отправляет в браузер многотысячный список.
 */
export async function getOzonMapArea(
  rawViewport: OzonMapViewport,
  rawZoom: number,
): Promise<OzonMapArea> {
  const viewport = validViewport(rawViewport);
  const zoom = Math.max(0, Math.min(19, Math.round(Number(rawZoom) || 0)));
  const body = await ozonPost<PointMapResponse>("/v1/delivery/map", {
    viewport: {
      left_bottom: { lat: viewport.south, long: viewport.west },
      right_top: { lat: viewport.north, long: viewport.east },
    },
    zoom,
  });

  const centerLat = (viewport.south + viewport.north) / 2;
  const centerLong = (viewport.west + viewport.east) / 2;
  const pointIds = new Set<number>();
  const clusters: PublicOzonCluster[] = [];

  for (const [index, cluster] of (body.clusters ?? []).entries()) {
    const lat = Number(cluster.coordinate?.lat);
    const long = Number(cluster.coordinate?.long);
    if (!Number.isFinite(lat) || !Number.isFinite(long)) continue;

    const ids = (cluster.map_point_ids ?? [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    const pointsCount = Math.max(Number(cluster.points_count) || ids.length || 1, 1);

    // На максимальном масштабе Ozon может объединить несколько ПВЗ в одном здании.
    const canShowAsPoints = ids.length > 0 && (pointsCount === 1 || zoom >= 17);
    if (canShowAsPoints && pointIds.size + ids.length <= MAX_POINT_DETAILS) {
      ids.forEach((id) => pointIds.add(id));
      continue;
    }

    const clusterViewport = cluster.viewport;
    const south = Number(clusterViewport?.left_bottom?.lat);
    const west = Number(clusterViewport?.left_bottom?.long);
    const north = Number(clusterViewport?.right_top?.lat);
    const east = Number(clusterViewport?.right_top?.long);
    clusters.push({
      id: `${lat}:${long}:${pointsCount}:${index}`,
      lat,
      long,
      pointsCount,
      viewport:
        [south, west, north, east].every(Number.isFinite) && south < north && west < east
          ? { south, west, north, east }
          : {
              south: lat - 0.08,
              west: long - 0.12,
              north: lat + 0.08,
              east: long + 0.12,
            },
    });
  }

  if (!pointIds.size) return { points: [], clusters };

  const info = await ozonPost<PointInfoResponse>("/v1/delivery/point/info", {
    map_point_ids: [...pointIds].map(String),
  });
  const points = (info.points ?? [])
    .filter((point) => point.enabled && point.delivery_method?.map_point_id)
    .map((point) => {
      const method = point.delivery_method!;
      const pointLat = Number(method.coordinates?.lat);
      const pointLong = Number(method.coordinates?.long);
      return {
        id: method.map_point_id!,
        name: method.name || "Пункт Ozon",
        address: method.address || "Адрес уточняется в Ozon",
        lat: pointLat,
        long: pointLong,
        distanceKm:
          Math.round(haversine(centerLat, centerLong, pointLat, pointLong) * 10) / 10,
      };
    })
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.long))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { points, clusters };
}

function catalogLines(items: Array<{ slug: string; qty: number }>): CatalogLine[] {
  const products = new Map(getProducts().map((product) => [product.slug, product]));
  const lines: CatalogLine[] = [];
  for (const item of items) {
    const product = products.get(item.slug);
    if (!product) throw new Error("Товар из корзины больше не продаётся.");
    if (!product.ozonSku) {
      throw new Error(
        `Для «${product.title}» ещё не указан SKU Ozon. Выберите оформление через WhatsApp.`,
      );
    }
    lines.push({
      slug: product.slug,
      sku: product.ozonSku,
      ...(product.ozonOfferId ? { offerId: product.ozonOfferId } : {}),
      quantity: item.qty,
      price: product.price,
    });
  }
  return lines;
}

function ozonDeliveryCharge(lines: CatalogLine[]): number {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return subtotal < OZON_DELIVERY_THRESHOLD ? OZON_DELIVERY_SURCHARGE : 0;
}

function validSplits(body: CheckoutResponse, lines: CatalogLine[]): OzonDeliverySplit[] {
  const bySku = new Map(lines.map((line) => [line.sku, line]));
  const splits: OzonDeliverySplit[] = [];
  for (const split of body.splits ?? []) {
    const method = split.delivery_method;
    const timeslot = method?.timeslots?.find(
      (slot) =>
        slot.timeslot_id &&
        slot.logistic_date_range?.from &&
        slot.logistic_date_range?.to,
    );
    if (
      split.unavailable_reason !== "UNSPECIFIED" ||
      method?.unavailable_reason !== "UNSPECIFIED" ||
      !split.warehouse_id ||
      (split.delivery_schema !== "FBO" && split.delivery_schema !== "FBS") ||
      !method?.id ||
      (method.delivery_type !== "PVZ" && method.delivery_type !== "POSTAMAT") ||
      !timeslot?.timeslot_id ||
      !timeslot.logistic_date_range?.from ||
      !timeslot.logistic_date_range?.to
    ) {
      continue;
    }
    const items = (split.items ?? [])
      .map((item) => {
        const line = item.sku ? bySku.get(item.sku) : undefined;
        if (!line || !item.sku || !item.quantity) return null;
        return {
          slug: line.slug,
          sku: item.sku,
          ...(item.offer_id || line.offerId
            ? { offerId: item.offer_id || line.offerId }
            : {}),
          quantity: item.quantity,
        };
      })
      .filter((item): item is OzonDeliverySplit["items"][number] => item !== null);
    if (!items.length) continue;
    splits.push({
      deliverySchema: split.delivery_schema,
      warehouseId: split.warehouse_id,
      deliveryMethod: {
        id: method.id,
        type: method.delivery_type,
        timeslotId: timeslot.timeslot_id,
        logisticFrom: timeslot.logistic_date_range.from,
        logisticTo: timeslot.logistic_date_range.to,
      },
      items,
    });
  }

  const covered = new Set(splits.flatMap((split) => split.items.map((item) => item.sku)));
  if (lines.some((line) => !covered.has(line.sku))) {
    throw new Error("Ozon не нашёл маршрут для всех товаров в корзине.");
  }
  return splits;
}

export async function quoteOzonPickup(input: {
  phone: string;
  pointId: number;
  items: Array<{ slug: string; qty: number }>;
}): Promise<OzonDeliverySelection> {
  const phone = cleanPhone(input.phone);
  if (!/^7\d{10}$/.test(phone)) throw new Error("Проверьте номер телефона.");
  const point = await officialPoint(input.pointId);
  const lines = catalogLines(input.items);
  const body = await ozonPost<CheckoutResponse>("/v2/delivery/checkout", {
    buyer_phone: phone,
    delivery_schema: "MIX",
    delivery_type: { pick_up: { map_point_id: point.id } },
    items: lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
  });
  const splits = validSplits(body, lines);
  if (!splits.length) throw new Error("Ozon Доставка сейчас недоступна для этого ПВЗ.");

  const from = splits.map((split) => split.deliveryMethod.logisticFrom).sort()[0];
  const to = splits.map((split) => split.deliveryMethod.logisticTo).sort().at(-1);
  const customerPrice = ozonDeliveryCharge(lines);
  const token = crypto.randomUUID();
  selections.set(token, {
    expiresAt: Date.now() + SELECTION_TTL_MS,
    phone,
    point,
    lines,
    customerPrice,
    splits,
    ...(from ? { estimatedFrom: from } : {}),
    ...(to ? { estimatedTo: to } : {}),
  });
  return {
    provider: "ozon",
    type: "pickup",
    point,
    customerPrice,
    ...(from ? { estimatedFrom: from } : {}),
    ...(to ? { estimatedTo: to } : {}),
    token,
  };
}

/** Одноразово забирает серверный расчёт; браузер не может подменить маршрут. */
export function consumeOzonSelection(
  token: string,
  phone: string,
  items: OrderItem[],
): OrderDelivery {
  const selection = selections.get(token);
  selections.delete(token);
  if (!selection || selection.expiresAt < Date.now()) {
    throw new Error("Расчёт доставки устарел — выберите ПВЗ ещё раз.");
  }
  if (selection.phone !== cleanPhone(phone)) {
    throw new Error("После расчёта доставки изменился телефон — выберите ПВЗ ещё раз.");
  }
  const wanted = new Map(items.map((item) => [item.slug, item.qty]));
  if (
    selection.lines.length !== wanted.size ||
    selection.lines.some((line) => wanted.get(line.slug) !== line.quantity)
  ) {
    throw new Error("Корзина изменилась — пересчитайте Ozon Доставку.");
  }
  return {
    provider: "ozon",
    type: "pickup",
    mapPointId: selection.point.id,
    pointName: selection.point.name,
    address: selection.point.address,
    customerPrice: selection.customerPrice,
    splits: selection.splits,
    ...(selection.estimatedFrom ? { estimatedFrom: selection.estimatedFrom } : {}),
    ...(selection.estimatedTo ? { estimatedTo: selection.estimatedTo } : {}),
  };
}

function nameParts(fullName: string): { first: string; last: string; middle?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) throw new Error("Для Ozon Доставки укажите фамилию и имя.");
  const [last, first, ...middle] = parts;
  return { first, last, ...(middle.length ? { middle: middle.join(" ") } : {}) };
}

function money(rubles: number): { currency_code: "RUB"; units: number; nanos: number } {
  const kopeks = Math.round(rubles * 100);
  return {
    currency_code: "RUB",
    units: Math.floor(kopeks / 100),
    nanos: (kopeks % 100) * 10_000_000,
  };
}

/** Создаёт отправление только для уже подтверждённо оплаченного заказа. */
export async function createOzonShipment(order: Order): Promise<OrderCreateResponse> {
  if (order.payment?.status !== "CAPTURED") {
    throw new Error("Неоплаченный заказ нельзя передать в Ozon Доставку.");
  }
  if (!order.delivery) throw new Error("У заказа не выбрана Ozon Доставка.");
  const person = nameParts(order.customer.name);
  const phone = cleanPhone(order.customer.phone);
  const bySlug = new Map(order.items.map((item) => [item.slug, item]));
  const factor = 1 - (order.promo?.percent ?? 0) / 100;

  const response = await ozonPost<OrderCreateResponse>("/v2/order/create", {
    buyer: {
      first_name: person.first,
      last_name: person.last,
      ...(person.middle ? { middle_name: person.middle } : {}),
      phone,
    },
    delivery: { pick_up: { map_point_id: order.delivery.mapPointId } },
    delivery_schema: "MIX",
    recipient: {
      recipient_first_name: person.first,
      recipient_last_name: person.last,
      ...(person.middle ? { recipient_middle_name: person.middle } : {}),
      recipient_phone: phone,
    },
    splits: order.delivery.splits.map((split) => ({
      delivery_method: {
        delivery_method_id: split.deliveryMethod.id,
        delivery_type: split.deliveryMethod.type,
        timeslot_id: split.deliveryMethod.timeslotId,
        logistic_date_range: {
          from: split.deliveryMethod.logisticFrom,
          to: split.deliveryMethod.logisticTo,
        },
        // Не передаём price: по документации это бесплатная доставка для клиента.
      },
      items: split.items.map((item) => {
        const ordered = bySlug.get(item.slug);
        if (!ordered) throw new Error(`Товар ${item.slug} не найден в заказе.`);
        return {
          sku: item.sku,
          ...(item.offerId ? { offer_id: item.offerId } : {}),
          quantity: item.quantity,
          price: money(ordered.price * factor),
        };
      }),
      warehouse_id: split.warehouseId,
    })),
  });
  if (!response.order_number) throw new Error("Ozon не вернул номер заказа.");
  return response;
}
