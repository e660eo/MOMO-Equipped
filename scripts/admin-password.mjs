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

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Ввод не отображаем: пароль не должен остаться на экране и в истории.
  const wasRaw = process.stdin.isTTY;
  if (wasRaw) {
    rl.output.write(question);
    rl._writeToOutput = () => {};
  }
  return new Promise((resolve) => {
    rl.question(wasRaw ? "" : question, (answer) => {
      if (wasRaw) rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
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

console.log("\nВставьте эти строки в файл .env.local рядом с package.json:\n");
console.log(`ADMIN_PASSWORD_HASH='${hashPassword(password)}'`);
console.log(`ADMIN_SESSION_SECRET='${crypto.randomBytes(32).toString("hex")}'`);
console.log(
  "\nПароль запомните — восстановить его из этих строк нельзя, только задать новый.",
);
