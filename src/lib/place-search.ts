import cities from "../../public/data/russian-cities.json";
export interface PublicPlaceResult { id: string; label: string; lat: number; long: number; zoom: number }
const normalize = (value: string) => value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
/** Поиск только в локальном справочнике: запрос не передаётся третьим лицам. */
export async function searchRussianPlaces(query: string): Promise<PublicPlaceResult[]> {
  if (typeof query !== "string") throw new Error("Введите название города.");
  const clean = normalize(query.slice(0, 120));
  if (clean.length < 2) throw new Error("Введите хотя бы две буквы названия города.");
  return cities.filter(c => normalize(c.city + " " + c.region).includes(clean))
    .sort((a, b) => Number(normalize(b.city) === clean) - Number(normalize(a.city) === clean))
    .slice(0, 8).map(c => ({ id: c.city + ":" + c.lat + ":" + c.long, label: c.city + ", " + c.region, lat: c.lat, long: c.long, zoom: 12 }));
}
