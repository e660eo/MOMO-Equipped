/*
  Создаёт компактный справочник для шапки из открытого набора HFLabs:
  https://github.com/hflabs/city (CC BY-SA 4.0).

  Запуск:
    node scripts/build-russian-cities.mjs путь/к/city.csv
*/
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Укажите путь к city.csv.");

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  fields.push(value);
  return fields;
}

const lines = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
const headers = parseCsvLine(lines.shift() ?? "");
const column = Object.fromEntries(headers.map((name, index) => [name, index]));

function formatRegion(type, name) {
  if (!name) return "";
  if (type === "г") return name;
  if (type === "Респ") return `Республика ${name}`;
  if (type === "обл") return `${name} область`;
  if (type === "АО") return `${name} автономный округ`;
  if (type === "Аобл") return `${name} автономная область`;
  return type ? `${name} ${type}` : name;
}

const cities = lines
  .filter(Boolean)
  .map(parseCsvLine)
  .map((row) => ({
    city:
      row[column.city]?.trim() ||
      row[column.settlement]?.trim() ||
      row[column.address]?.split(",").at(-1)?.trim().replace(/^г\s+/u, ""),
    region: formatRegion(row[column.region_type]?.trim(), row[column.region]?.trim()),
    lat: Number(row[column.geo_lat]),
    long: Number(row[column.geo_lon]),
  }))
  .filter(
    (item) =>
      item.city &&
      item.region &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.long),
  )
  .sort(
    (a, b) =>
      a.city.localeCompare(b.city, "ru") || a.region.localeCompare(b.region, "ru"),
  );

const output = path.resolve("public/data/russian-cities.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(cities)}\n`, "utf8");
console.log(`Создано: ${output} (${cities.length} городов)`);
