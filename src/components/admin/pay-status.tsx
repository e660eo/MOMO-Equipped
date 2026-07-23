/*
  Состояние приёма оплаты на сайте.

  Компонент серверный и намеренно без кнопок: ключи Яндекс Пэй живут в
  окружении сервера, из панели их не правят. Задача блока — чтобы владелец
  видел, включена ли оплата и не идёт ли она до сих пор в песочнице.
*/

export interface PayStatus {
  configured: boolean;
  sandbox: boolean;
  /** Адрес, который нужно вписать в кабинете Яндекс Пэй. */
  callbackUrl: string;
}

export function PayStatusPanel({ status }: { status: PayStatus }) {
  return (
    <section className="max-w-[680px] rounded-sm border border-border bg-surface p-5">
      <h2 className="font-display text-base font-extrabold uppercase">
        Оплата на сайте
      </h2>

      {!status.configured ? (
        <p className="mt-2 text-[0.85rem] leading-relaxed">
          Не подключена — покупатели оформляют заказ через WhatsApp, как
          раньше. Что нужно сделать, чтобы заработали карта и Сплит, описано
          в разделе «Оплата на сайте» файла DEPLOY.md.
        </p>
      ) : status.sandbox ? (
        <>
          <p className="mt-2 rounded-sm border border-[var(--signal-text)] px-3 py-2 text-[0.85rem] font-semibold leading-relaxed text-[var(--signal-text)]">
            Тестовый режим: деньги не списываются по-настоящему.
          </p>
          <p className="mt-2 text-[0.85rem] leading-relaxed">
            В корзине есть кнопка «Оплатить на сайте», но платежи ненастоящие.
            Чтобы принимать деньги, нужны боевой ключ и переменная
            <code className="mx-1 font-mono text-[0.8rem]">YANDEX_PAY_LIVE=1</code>
            на сервере — и обязательно подключённая онлайн-касса: без чека
            принимать оплату нельзя по закону.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[0.85rem] leading-relaxed">
          Работает в боевом режиме: покупатели платят картой или Сплитом,
          деньги настоящие. Оплата покрывает только товар — доставку
          согласовывает менеджер.
        </p>
      )}

      <p className="mt-3 text-[0.78rem] leading-relaxed text-muted-foreground">
        Адрес для уведомлений (Callback URL) в кабинете Яндекс Пэй:
        <br />
        <code className="select-all font-mono text-[0.8rem] text-foreground">
          {status.callbackUrl}
        </code>
      </p>
    </section>
  );
}
