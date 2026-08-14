import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

process.umask?.(0o077);
const { loadEnvConfig } = nextEnv;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvConfig(root);
const dataDir = process.env.MOMO_DATA_DIR?.trim() || path.join(root, "data");

function read(name, fallback = []) {
  const file = path.join(dataDir, name);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function write(name, value) {
  const file = path.join(dataDir, name);
  if (fs.existsSync(file)) {
    const backups = path.join(dataDir, "backups");
    fs.mkdirSync(backups, { recursive: true, mode: 0o700 });
    fs.chmodSync(backups, 0o700);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(backups, `${name}.${stamp}`);
    fs.copyFileSync(file, backup);
    fs.chmodSync(backup, 0o600);
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
}

function receiptContact(customer) {
  const email = customer?.email?.trim().toLowerCase();
  if (email) return email;
  const digits = String(customer?.phone ?? "").replace(/\D/g, "").replace(/^8/, "7");
  return digits.startsWith("7") ? `+${digits}` : `+7${digits}`;
}

fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
fs.chmodSync(dataDir, 0o700);

const customers = read("customers.json");
const customerById = new Map(customers.map((customer) => [customer.id, customer]));

const products = read("products.json");
let availabilityFixed = 0;
for (const product of products) {
  if (typeof product.stock !== "number" && typeof product.inStock !== "boolean") {
    product.inStock = false;
    availabilityFixed += 1;
  }
}
if (availabilityFixed) write("products.json", products);

const seedDealersFile = path.join(root, "data", "dealers.json");
const seedDealers = JSON.parse(fs.readFileSync(seedDealersFile, "utf8"));
const dealers = read("dealers.json");
let dealerLocationsAdded = 0;
for (const seedDealer of seedDealers) {
  if (dealers.some((dealer) => dealer.id === seedDealer.id)) continue;
  dealers.push(seedDealer);
  dealerLocationsAdded += 1;
}
if (dealerLocationsAdded) write("dealers.json", dealers);

const fiscalEnabled = process.env.YANDEX_PAY_LIVE?.trim() === "1" || process.env.YANDEX_PAY_FISCAL?.trim() === "1";
const orders = read("orders.json");
let orderChanges = 0;
let receiptBackfills = 0;
for (const order of orders) {
  let changed = false;
  if (!Array.isArray(order.history) || order.history.length === 0) {
    order.history = [{ at: order.createdAt, actor: "Система", type: "created", detail: "История восстановлена из заказа" }];
    changed = true;
  }
  if (!order.customer?.email && order.customerId) {
    const customer = customerById.get(order.customerId);
    if (customer?.email) {
      order.customer.email = customer.email;
      changed = true;
    }
  }
  if (fiscalEnabled && order.payment && !order.payment.receipt) {
    order.payment.receipt = {
      provider: "yandex_pay",
      status: "submitted",
      contact: receiptContact(order.customer),
      submittedAt: order.payment.updatedAt || order.createdAt,
    };
    receiptBackfills += 1;
    changed = true;
  }
  if (changed) orderChanges += 1;
}
if (orderChanges) write("orders.json", orders);

if (receiptBackfills) {
  const jobs = read("integration-jobs.json");
  const now = new Date().toISOString();
  for (const order of orders.filter((item) => item.payment?.receipt && item.payment?.status === "CAPTURED")) {
    if (jobs.some((job) => job.type === "fiscal_check" && job.entityId === order.id && job.status !== "failed")) continue;
    jobs.unshift({
      id: crypto.randomUUID(),
      type: "fiscal_check",
      entityId: order.id,
      status: "pending",
      attempts: 0,
      runAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  write("integration-jobs.json", jobs.slice(0, 1000));
}

function harden(dir) {
  if (!fs.existsSync(dir)) return;
  fs.chmodSync(dir, 0o700);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) harden(full);
    else if (entry.isFile()) fs.chmodSync(full, 0o600);
  }
}
harden(dataDir);

console.log(`  Миграция данных: наличие ${availabilityFixed}, дилеры ${dealerLocationsAdded}, заказы ${orderChanges}, чеки ${receiptBackfills}. Права 700/600 применены.`);
