/*
  Готовит крошечные подмножества шрифтов для двух мест, где Google заставляет
  качать целый набор символов ради нескольких знаков.

  1) Знак рубля. «₽» — это U+20BD, он лежит в блоке валют U+20AD–20C0, а тот
     отдаётся только вместе со всей латинской расширенной частью: чешской,
     польской, турецкой, вьетнамской. На сайте её нет, зато цены есть на каждой
     странице — и браузер честно тянул 115 КБ Unbounded и 15 КБ Manrope ради
     одного глифа.

  2) Полное название в шапке набрано Syne и больше нигде не встречается:
     не заставляем браузер скачивать всю гарнитуру ради одной надписи.

  Исходники берутся из файлов самой сборки (.next/static/media), поэтому контуры
  глифов те же байт в байт — начертание не меняется.

  Запуск (после `next build`, чтобы файлы сборки существовали):
      npm i --no-save subset-font && node scripts/make-font-subsets.mjs

  Пересобирать нужно, только если обновится сама гарнитура. Готовые файлы лежат
  в public/fonts и закоммичены, так что обычной сборке этот скрипт не нужен.
*/
import subsetFont from "subset-font";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const MEDIA = ".next/static/media";
const CSS_DIR = ".next/static/chunks";
const OUT = "public/fonts";

/** Собирает все @font-face из собранного CSS: семейство → { файл, диапазон }. */
async function readFontFaces() {
  const files = await readdir(CSS_DIR);
  let css = "";
  for (const f of files) {
    if (f.endsWith(".css")) css += await readFile(path.join(CSS_DIR, f), "utf8");
  }
  const faces = [];
  const re =
    /@font-face\{font-family:([^;]+);[^}]*?src:url\(\.\.\/media\/([^)]+)\)format\("woff2"\);unicode-range:([^}]+)\}/g;
  let m;
  while ((m = re.exec(css))) {
    faces.push({ family: m[1].trim(), file: m[2], range: m[3] });
  }
  return faces;
}

/** unicode-range для CSS: перечисляет ровно те кодовые точки, что вошли в файл. */
const rangeOf = (text) =>
  [...new Set([...text])]
    .map((c) => c.codePointAt(0))
    .sort((a, b) => a - b)
    .map((p) => "U+" + p.toString(16).toUpperCase().padStart(4, "0"))
    .join(",");

const faces = await readFontFaces();

/*
  Что и из чего режем. Ключ latinExt — набор с валютным блоком (в нём рубль),
  latin — основная латиница (в ней буквы вордмарка).
*/
const JOBS = [
  { family: "Unbounded", pick: "latinExt", text: "₽", out: "ruble-unbounded.woff2" },
  { family: "Manrope", pick: "latinExt", text: "₽", out: "ruble-manrope.woff2" },
  // И прописные, и строчные: капслок наводит CSS,
  // но полагаться на это при вырезании глифов не стоит.
  {
    family: "Syne",
    pick: "latin",
    text: "Modern Original Music Organization MODERN ORIGINAL MUSIC ORGANIZATION",
    out: "wordmark-syne.woff2",
    fallback: "public/fonts/syne-latin.woff2",
  },
];

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const face = faces.find(
    (f) =>
      f.family === job.family &&
      (job.pick === "latinExt"
        ? f.range.includes("U+20AD-20C0")
        : f.range.includes("U+2000-206F") && !f.range.includes("U+20AD-20C0")),
  );
  if (!face && !job.fallback) {
    console.error(`НЕ НАЙДЕН набор ${job.pick} у ${job.family} — пропускаю`);
    continue;
  }
  const src = await readFile(face ? path.join(MEDIA, face.file) : job.fallback);
  const subset = await subsetFont(src, job.text, { targetFormat: "woff2" });
  await writeFile(path.join(OUT, job.out), subset);
  console.log(
    `${job.family} (${job.pick}): ${(src.length / 1024).toFixed(0)} КБ → ${job.out} ` +
      `${(subset.length / 1024).toFixed(1)} КБ`,
  );
  console.log(`    unicode-range: ${rangeOf(job.text)}`);
}
