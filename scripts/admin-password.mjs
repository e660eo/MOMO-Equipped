#!/usr/bin/env node
/*
  Пароль для панели управления сайтом.

  Запуск на сервере:  node scripts/admin-password.mjs
  Скрипт спросит пароль и сам впишет хеш с секретом сессий в .env.local —
  переносить длинные строки руками не нужно, а при копировании мышью в них
  легко потерять символ. Сам пароль нигде не сохраняется и никуда не уходит.

  С флагом --print строки печатаются на экран вместо записи в файл.
*/
import crypto from "node:crypto";
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Один интерфейс на оба вопроса: с отдельным на каждый вопрос второй ответ
// терялся, когда ввод приходит не с клавиатуры (echo … | node …).
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
// Строки читаем итератором, а не rl.question: при вводе не с клавиатуры
// (echo … | node …) обе строки приходят разом, и ответ на второй вопрос
// терялся — колбэка в этот момент ещё нет, а итератор их буферизует.
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  /*
    Вопрос печатаем сами, до маскировки: она подменяет весь вывод readline,
    и заданный через rl.question вопрос стирался вместе с вводом — на экране
    оставался пустой курсор без единой подсказки.

    Печатаем звёздочки, а не прячем ввод совсем: видно, что клавиши доходят,
    а сам пароль на экране не остаётся.
  */
  process.stdout.write(question);
  if (process.stdin.isTTY) {
    rl._writeToOutput = (chunk) => {
      rl.output.write(chunk.includes("\n") ? "\n" : "*");
    };
  }

  const { value } = await lines.next();
  process.stdout.write("\n");
  return value ?? "";
}

const password = (await ask("Придумайте пароль для входа в панель: ")).trim();

if (password.length < 10) {
  console.error(
    "\nПароль короче 10 символов — панель открыта из интернета, возьмите длиннее.",
  );
  process.exit(1);
}

const repeat = (await ask("Повторите пароль: ")).trim();
if (repeat !== password) {
  console.error("\nПароли не совпали. Запустите скрипт заново.");
  process.exit(1);
}

rl.close();

const vars = {
  ADMIN_PASSWORD_HASH: hashPassword(password),
  ADMIN_SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
};
const remember =
  "Пароль запомните — восстановить его из этих строк нельзя, только задать новый.";

if (process.argv.includes("--print")) {
  console.log("\nВставьте эти строки в файл .env.local рядом с package.json:\n");
  for (const [key, value] of Object.entries(vars)) {
    console.log(`${key}='${value}'`);
  }
  console.log(`\n${remember}`);
  process.exit(0);
}

const envFile = path.join(process.cwd(), ".env.local");
const existing = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";

// Прежние значения выкидываем: два одинаковых ключа в файле — источник
// долгих разбирательств, почему пароль «не тот».
const kept = existing
  .split("\n")
  .filter((line) => !/^\s*(ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)\s*=/.test(line))
  .join("\n")
  .replace(/\n+$/, "");

const lines2 = Object.entries(vars).map(([k, v]) => `${k}='${v}'`);
fs.writeFileSync(
  envFile,
  `${kept ? `${kept}\n` : ""}${lines2.join("\n")}\n`,
  "utf8",
);
// Файл читаемый только владельцем: в нём ключи от панели.
fs.chmodSync(envFile, 0o600);

const hasDataDir = /^\s*MOMO_DATA_DIR\s*=/m.test(kept);

console.log(`\nГотово: пароль записан в ${envFile}`);
if (!hasDataDir) {
  console.log(
    "\nВ файле не хватает строки с папкой данных. Добавьте её командой:\n" +
      "  echo 'MOMO_DATA_DIR=/home/momo/momo-data' >> .env.local",
  );
}
console.log(
  "\nЧтобы сайт увидел изменения:\n  pm2 reload momo --update-env\n\n" + remember,
);
