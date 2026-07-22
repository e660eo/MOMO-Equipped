#!/usr/bin/env node
/*
  Пароль для панели управления сайтом.

  Запуск на сервере:  node scripts/admin-password.mjs
  Скрипт спросит пароль, напечатает две строки для .env.local и ничего
  никуда не отправит — сам пароль нигде не сохраняется.
*/
import crypto from "node:crypto";
import readline from "node:readline";

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

console.log("\nВставьте эти строки в файл .env.local рядом с package.json:\n");
console.log(`ADMIN_PASSWORD_HASH='${hashPassword(password)}'`);
console.log(`ADMIN_SESSION_SECRET='${crypto.randomBytes(32).toString("hex")}'`);
console.log(
  "\nПароль запомните — восстановить его из этих строк нельзя, только задать новый.",
);
