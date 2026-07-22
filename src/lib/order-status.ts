import type { OrderStatus } from "./types";

/*
  Названия статусов заказа. Отдельным файлом, потому что нужны и в панели, и
  в кабинете покупателя: модуль работы с заказами читает файлы с диска и в
  браузер попасть не может.
*/
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  in_work: "В работе",
  done: "Выполнен",
  canceled: "Отменён",
};
