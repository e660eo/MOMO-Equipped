import crypto from "node:crypto";
import { b2bPriceForSlug, getB2BPriceBook, type B2BPriceBook } from "./b2b-prices";
import { hashPassword } from "./password";
import { assertWritable, readJson, updateJson } from "./store";
import type {
  DealerAccount,
  DealerApplication,
  DealerApplicationStatus,
  DealerLocation,
  DealerLocationKind,
  DealerOrder,
  DealerOrderStatus,
  DealerPriceTier,
  OrderItem,
  Product,
} from "./types";

const DEALERS = "dealers.json";
const ACCOUNTS = "dealer-accounts.json";
const APPLICATIONS = "dealer-applications.json";
const ORDERS = "dealer-orders.json";

export function getDealerLocations(activeOnly = true): DealerLocation[] {
  const all = readJson<DealerLocation[]>(DEALERS);
  return (activeOnly ? all.filter((dealer) => dealer.active) : all)
    .slice()
    .sort((a, b) => a.city.localeCompare(b.city, "ru") || a.name.localeCompare(b.name, "ru"));
}
export function getDealerLocation(id: string): DealerLocation | undefined {
  return readJson<DealerLocation[]>(DEALERS).find((dealer) => dealer.id === id);
}

export function setDealerLocationActive(id: string, active: boolean): DealerLocation | undefined {
  assertWritable();
  let updated: DealerLocation | undefined;
  updateJson<DealerLocation[]>(DEALERS, (all) => all.map((dealer) => {
    if (dealer.id !== id) return dealer;
    updated = { ...dealer, active };
    return updated;
  }));
  return updated;
}

export function setDealerLocationProfile(
  id: string,
  patch: { kind: DealerLocationKind; authorizedInstallation: boolean },
): DealerLocation | undefined {
  assertWritable();
  let updated: DealerLocation | undefined;
  updateJson<DealerLocation[]>(DEALERS, (all) => all.map((dealer) => {
    if (dealer.id !== id) return dealer;
    updated = { ...dealer, ...patch };
    return updated;
  }));
  return updated;
}

export type DealerLocationDetailsPatch = Pick<
  DealerLocation,
  | "name"
  | "city"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "hours"
  | "latitude"
  | "longitude"
  | "kind"
  | "authorizedInstallation"
>;

/** Обновляет все данные публичной дилерской точки, не затрагивая её id и статус публикации. */
export function updateDealerLocationDetails(
  id: string,
  patch: DealerLocationDetailsPatch,
): DealerLocation | undefined {
  assertWritable();
  let updated: DealerLocation | undefined;
  updateJson<DealerLocation[]>(DEALERS, (all) => all.map((dealer) => {
    if (dealer.id !== id) return dealer;
    updated = { ...dealer, ...patch };
    return updated;
  }));
  return updated;
}

/**
 * Полностью удаляет дилерскую точку и все связанные с ней кабинеты.
 * Заказы намеренно остаются в отдельном журнале: удаление контрагента не
 * должно стирать историю уже оформленных отгрузок.
 */
export function deleteDealer(id: string): {
  dealer: DealerLocation;
  removedAccounts: DealerAccount[];
} | undefined {
  assertWritable();
  const dealer = getDealerLocation(id);
  if (!dealer) return undefined;

  const removedAccounts = getDealerAccounts().filter(
    (account) => account.dealerId === id,
  );
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.filter((account) => account.dealerId !== id),
  );
  updateJson<DealerLocation[]>(DEALERS, (all) =>
    all.filter((location) => location.id !== id),
  );

  return { dealer, removedAccounts };
}

export function getDealerAccounts(): DealerAccount[] {
  return readJson<DealerAccount[]>(ACCOUNTS);
}

export function findDealerAccount(id: string): DealerAccount | undefined {
  return getDealerAccounts().find((account) => account.id === id);
}

export function findDealerAccountByEmail(email: string): DealerAccount | undefined {
  const key = email.trim().toLowerCase();
  return getDealerAccounts().find((account) => account.email.toLowerCase() === key);
}

export function updateDealerAccountProfile(
  id: string,
  patch: Pick<DealerAccount, "contactName" | "email" | "priceTier" | "discountPercent">,
): DealerAccount | undefined {
  assertWritable();
  const normalizedEmail = patch.email.trim().toLowerCase();
  const duplicate = getDealerAccounts().find(
    (account) => account.id !== id && account.email.toLowerCase() === normalizedEmail,
  );
  if (duplicate) throw new Error("ACCOUNT_EXISTS");

  let updated: DealerAccount | undefined;
  updateJson<DealerAccount[]>(ACCOUNTS, (all) => all.map((account) => {
    if (account.id !== id) return account;
    updated = { ...account, ...patch, email: normalizedEmail };
    return updated;
  }));
  return updated;
}

export function dealerPriceFor(
  product: Product,
  account: DealerAccount,
  priceBook: B2BPriceBook = getB2BPriceBook(),
): number {
  const override = account.priceOverrides?.[product.slug];
  if (Number.isFinite(override) && Number(override) > 0) {
    return Math.round(Number(override) * 100) / 100;
  }
  const priceFromBook = b2bPriceForSlug(product.slug, account.priceTier ?? "dealer", priceBook);
  if (priceFromBook !== undefined) return priceFromBook;
  return Math.max(1, Math.round(product.price * (100 - account.discountPercent) / 100));
}

export function getDealerApplications(): DealerApplication[] {
  return readJson<DealerApplication[]>(APPLICATIONS).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addDealerApplication(
  input: Omit<DealerApplication, "id" | "createdAt" | "status">,
): DealerApplication {
  assertWritable();
  const application: DealerApplication = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  updateJson<DealerApplication[]>(APPLICATIONS, (all) => [application, ...all]);
  return application;
}

export function updateDealerApplication(
  id: string,
  patch: { status?: DealerApplicationStatus; note?: string },
): void {
  assertWritable();
  updateJson<DealerApplication[]>(APPLICATIONS, (all) =>
    all.map((application) => application.id === id ? { ...application, ...patch } : application),
  );
}

function inviteDigest(token: string): string {
  return crypto.createHash("sha256").update(`dealer-invite:${token}`).digest("hex");
}

export function issueDealerInvite(accountId: string): string | null {
  assertWritable();
  if (!findDealerAccount(accountId)) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.map((account) => account.id === accountId
      ? { ...account, inviteHash: inviteDigest(token), inviteExpiresAt: expires }
      : account),
  );
  return token;
}

export function accountForInvite(token: string): DealerAccount | undefined {
  const digest = inviteDigest(token);
  return getDealerAccounts().find((account) =>
    account.inviteHash === digest &&
    Boolean(account.inviteExpiresAt) &&
    new Date(account.inviteExpiresAt!).getTime() > Date.now() &&
    !account.disabled,
  );
}

export function activateDealerAccount(token: string, password: string): DealerAccount | null {
  assertWritable();
  const account = accountForInvite(token);
  if (!account) return null;
  const passwordHash = hashPassword(password);
  const activatedAt = new Date().toISOString();
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.map((item) => item.id === account.id
      ? {
          ...item,
          passwordHash,
          activatedAt,
          inviteHash: undefined,
          inviteExpiresAt: undefined,
        }
      : item),
  );
  return { ...account, passwordHash, activatedAt, inviteHash: undefined, inviteExpiresAt: undefined };
}

export function markDealerLogin(accountId: string): void {
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.map((account) => account.id === accountId
      ? { ...account, lastLoginAt: new Date().toISOString() }
      : account),
  );
}

export function recordDealerAccessMail(
  accountId: string,
  result: { ok: boolean; error?: string },
): void {
  assertWritable();
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.map((account) => account.id === accountId ? {
      ...account,
      lastAccessMailAt: new Date().toISOString(),
      lastAccessMailError: result.ok ? undefined : result.error?.slice(0, 500),
    } : account),
  );
}

export function createDealer(input: {
  name: string;
  city: string;
  address: string;
  phone: string;
  publicEmail?: string;
  website?: string;
  hours?: string;
  latitude?: number;
  longitude?: number;
  kind: DealerLocationKind;
  authorizedInstallation?: boolean;
  contactName: string;
  loginEmail: string;
  priceTier: DealerPriceTier;
  discountPercent: number;
  applicationId?: string;
}): { dealer: DealerLocation; account: DealerAccount; inviteToken: string } {
  assertWritable();
  if (findDealerAccountByEmail(input.loginEmail)) throw new Error("ACCOUNT_EXISTS");

  const now = new Date().toISOString();
  const dealer: DealerLocation = {
    id: crypto.randomUUID(),
    name: input.name,
    city: input.city,
    address: input.address,
    phone: input.phone,
    ...(input.publicEmail ? { email: input.publicEmail } : {}),
    ...(input.website ? { website: input.website } : {}),
    ...(input.hours ? { hours: input.hours } : {}),
    ...(Number.isFinite(input.latitude) ? { latitude: input.latitude } : {}),
    ...(Number.isFinite(input.longitude) ? { longitude: input.longitude } : {}),
    kind: input.kind,
    ...(input.authorizedInstallation ? { authorizedInstallation: true } : {}),
    active: true,
    createdAt: now,
  };
  const account: DealerAccount = {
    id: crypto.randomUUID(),
    dealerId: dealer.id,
    contactName: input.contactName,
    email: input.loginEmail.toLowerCase(),
    // До активации вход невозможен: это случайный неизвестный пароль.
    passwordHash: hashPassword(crypto.randomBytes(48).toString("base64url")),
    priceTier: input.priceTier,
    discountPercent: input.discountPercent,
    createdAt: now,
  };
  updateJson<DealerLocation[]>(DEALERS, (all) => [...all, dealer]);
  updateJson<DealerAccount[]>(ACCOUNTS, (all) => [...all, account]);
  if (input.applicationId) updateDealerApplication(input.applicationId, { status: "approved" });
  const inviteToken = issueDealerInvite(account.id)!;
  return { dealer, account: findDealerAccount(account.id)!, inviteToken };
}

export function updateDealerTerms(
  accountId: string,
  patch: { priceTier?: DealerPriceTier; discountPercent?: number; disabled?: boolean },
): void {
  assertWritable();
  updateJson<DealerAccount[]>(ACCOUNTS, (all) =>
    all.map((account) => account.id === accountId ? { ...account, ...patch } : account),
  );
}

export function getDealerOrders(accountId?: string): DealerOrder[] {
  const all = readJson<DealerOrder[]>(ORDERS);
  return (accountId ? all.filter((order) => order.accountId === accountId) : all)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function nextDealerOrderId(all: DealerOrder[]): string {
  const date = new Date();
  const prefix = `D-${String(date.getDate()).padStart(2, "0")}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const count = all.filter((order) => order.id.startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(3, "0")}`;
}

export function createDealerOrder(input: {
  account: DealerAccount;
  items: OrderItem[];
  comment?: string;
}): DealerOrder {
  assertWritable();
  let created!: DealerOrder;
  updateJson<DealerOrder[]>(ORDERS, (all) => {
    created = {
      id: nextDealerOrderId(all),
      dealerId: input.account.dealerId,
      accountId: input.account.id,
      createdAt: new Date().toISOString(),
      status: "new",
      items: input.items,
      total: input.items.reduce((sum, item) => sum + item.price * item.qty, 0),
      ...(input.comment ? { comment: input.comment } : {}),
      history: [{ at: new Date().toISOString(), actor: input.account.contactName, to: "new" }],
    };
    return [created, ...all];
  });
  return created;
}

export function updateDealerOrderStatus(id: string, status: DealerOrderStatus): void {
  assertWritable();
  updateJson<DealerOrder[]>(ORDERS, (all) =>
    all.map((order) => order.id === id && order.status !== status
      ? {
          ...order,
          status,
          history: [
            ...order.history,
            { at: new Date().toISOString(), actor: "Администратор", from: order.status, to: status },
          ],
        }
      : order),
  );
}
