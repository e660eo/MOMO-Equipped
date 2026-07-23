import { headers } from "next/headers";

/*
  Адрес клиента для счётчиков попыток.

  Берём X-Real-IP: nginx ставит его из $remote_addr и ПЕРЕЗАПИСЫВАЕТ, что бы
  ни прислал браузер. X-Forwarded-For для этого не годится — nginx собирает
  его через $proxy_add_x_forwarded_for, то есть дописывает настоящий адрес
  в КОНЕЦ, а начало строки приходит от клиента. Прежний код брал оттуда
  первый элемент, и любой лимит снимался одной строкой в заголовке:
  «X-Forwarded-For: 1.2.3.4» — и ты снова новый посетитель.

  Запасной путь на случай, если заголовка нет (запуск без nginx, чужая
  конфигурация): последний элемент цепочки — тот, который добавил наш
  собственный прокси. См. deploy/nginx.conf.example.
*/
export async function clientIp(): Promise<string> {
  const h = await headers();

  const real = h.get("x-real-ip")?.trim();
  if (real) return real;

  const chain = h.get("x-forwarded-for")?.split(",");
  return chain?.at(-1)?.trim() || "local";
}
