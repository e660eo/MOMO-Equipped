"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/account-store";
import { useToast } from "@/lib/toast-store";
import { isPhoneComplete } from "@/lib/phone";
import { PhoneInput } from "./phone-input";
import { ConsentCheckbox } from "./consent-checkbox";
import { attemptAdminLogin } from "@/app/admin-entry";
import { signIn, signUp } from "@/app/customer-actions";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-sm text-foreground transition-colors focus:border-signal focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

/*
  Вход и регистрация покупателя.

  Аккаунт серверный: пароль уходит на сервер и хранится там scrypt-хешем, а
  сессия живёт в подписанной куке — заказы видны с любого устройства. Раньше
  аккаунт лежал в браузере и пропадал вместе с очисткой кэша.

  Той же формой владелец входит в панель: если пара совпала с его почтой и
  паролем, открывается /admin. По форме этого не видно — посторонний получит
  обычную ошибку входа.

  Кнопка Яндекс ID — заглушка с явной пометкой: OAuth ещё не подключён,
  и притворяться рабочей она не должна.
*/
export function AuthModal() {
  const router = useRouter();
  const open = useAccount((s) => s.modalOpen);
  const closeModal = useAccount((s) => s.closeModal);
  const pushToast = useToast((s) => s.push);

  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [lgId, setLgId] = useState("");
  const [lgPass, setLgPass] = useState("");
  const [lgShow, setLgShow] = useState(false);
  const [rgName, setRgName] = useState("");
  const [rgEmail, setRgEmail] = useState("");
  const [rgPhone, setRgPhone] = useState("");
  const [rgPass, setRgPass] = useState("");

  function switchTab(next: "login" | "register") {
    setTab(next);
    setError("");
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    /*
      Сначала пробуем вход владельца: та же пара «почта + пароль» открывает
      панель управления, чтобы не помнить отдельный адрес. Для всех остальных
      ответ отрицательный, и дальше идёт обычный вход в кабинет покупателя —
      по форме не видно, что какая-то почта особенная.
    */
    if (lgId.includes("@")) {
      const result = await attemptAdminLogin(lgId, lgPass);
      if (result === "ok") {
        setBusy(false);
        setLgPass("");
        closeModal();
        window.location.href = "/admin";
        return;
      }
      if (result === "throttled") {
        setBusy(false);
        setError(
          "Слишком много попыток входа. Подождите десять минут и попробуйте снова.",
        );
        return;
      }
    }

    const result = await signIn(lgId, lgPass);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    setLgPass("");
    closeModal();
    pushToast({ title: "С возвращением!", description: "Вы вошли в кабинет." });
    // Обновляем страницу целиком: сессия живёт в куке, и серверная разметка
    // (шапка, кабинет) должна перерисоваться с новыми данными.
    router.refresh();
    router.push("/profile");
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneComplete(rgPhone)) {
      setError("Проверьте телефон — в номере должно быть 10 цифр после +7.");
      return;
    }
    setBusy(true);
    const result = await signUp({
      name: rgName,
      email: rgEmail,
      phone: rgPhone,
      password: rgPass,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    setRgPass("");
    closeModal();
    pushToast({
      title: "Аккаунт создан",
      description: "Теперь заказы видны с любого устройства.",
    });
    router.refresh();
    router.push("/profile");
  }


  return (
    <>
      <div
        onClick={closeModal}
        className={cn(
          "fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/*
        На телефоне окно НЕ центрируем, а прижимаем шторкой к низу (как фильтры
        каталога): при центрировании экранная клавиатура заставляла браузер
        подтягивать сфокусированное поле, и верх окна уезжал за край экрана
        без шанса до него доскроллить. Высота в dvh, а не vh — vh на мобильных
        не учитывает адресную строку. На sm+ остаётся центрированное окно.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Личный кабинет"
        className={cn(
          "fixed z-[100] overflow-y-auto border border-border bg-surface shadow-xl transition-all",
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          "sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:w-[min(440px,calc(100vw-32px))] sm:rounded-md sm:p-8",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0 sm:translate-y-3",
        )}
      >
        <button
          onClick={closeModal}
          aria-label="Закрыть"
          className="absolute right-3.5 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
        >
          <X size={15} />
        </button>

        <h3 className="font-display text-lg font-semibold uppercase">
          Личный кабинет
        </h3>

        <div className="my-5 flex gap-1 rounded-full border border-border p-1">
          {(
            [
              ["login", "Вход"],
              ["register", "Регистрация"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
                tab === key
                  ? "bg-signal text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "login" ? (
          <form className="space-y-3.5" onSubmit={onLogin}>
            <div>
              <label className={labelCls} htmlFor="lg-contact">
                Телефон или email
              </label>
              <input
                id="lg-contact"
                type="text"
                required
                value={lgId}
                onChange={(e) => setLgId(e.target.value)}
                autoComplete="username"
                placeholder="+7 ___ ___-__-__ или you@mail.ru"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lg-pass">
                Пароль
              </label>
              {/*
                Показ пароля нужен не для красоты: менеджер паролей молча
                подставляет сюда сохранённую пару, и человек не понимает,
                почему «правильный» пароль не подходит.
              */}
              <div className="relative">
                <input
                  id="lg-pass"
                  type={lgShow ? "text" : "password"}
                  required
                  value={lgPass}
                  onChange={(e) => setLgPass(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(inputCls, "pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setLgShow((v) => !v)}
                  aria-label={lgShow ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-signal"
                >
                  {lgShow ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
            >
              {busy ? "Проверяем…" : "Войти"}
            </button>
            {/*
              Восстановления пароля нет: письма сайт пока не отправляет, а
              кнопка, которая ничего не делает, хуже её отсутствия. Забывшему
              поможет менеджер — этот путь работает на самом деле.
            */}
            <p className="text-center font-mono text-[0.66rem] leading-relaxed tracking-wide text-muted-foreground">
              Забыли пароль? Напишите нам в WhatsApp — поможем войти.
            </p>
          </form>
        ) : (
          <form className="space-y-3.5" onSubmit={onRegister}>
            <div>
              <label className={labelCls} htmlFor="rg-name">
                Имя
              </label>
              <input
                id="rg-name"
                type="text"
                required
                value={rgName}
                onChange={(e) => setRgName(e.target.value)}
                autoComplete="name"
                placeholder="Как к вам обращаться"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-phone">
                Телефон
              </label>
              <PhoneInput
                id="rg-phone"
                value={rgPhone}
                onChange={setRgPhone}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-email">
                Email
              </label>
              <input
                id="rg-email"
                type="email"
                required
                value={rgEmail}
                onChange={(e) => setRgEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@mail.ru"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="rg-pass">
                Пароль
              </label>
              <input
                id="rg-pass"
                type="password"
                required
                minLength={8}
                value={rgPass}
                onChange={(e) => setRgPass(e.target.value)}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                className={inputCls}
              />
            </div>
            <ConsentCheckbox id="rg-consent" className="pt-1" />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
            >
              {busy ? "Создаём…" : "Создать аккаунт"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-signal">
            {error}
          </p>
        )}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            или
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Заглушка: OAuth требует сервера, кнопка не притворяется рабочей */}
        <button
          type="button"
          disabled
          title="Вход через Яндекс ID появится после переезда сайта на сервер"
          className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-sm border border-border py-3 text-sm font-semibold opacity-60"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FC3F1D] text-[0.8rem] font-bold text-white">
            Я
          </span>
          Войти через Яндекс ID
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-muted-foreground">
            скоро
          </span>
        </button>

        <p className="mt-4 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
          Аккаунт пока хранится только в этом браузере: пароль — необратимым
          хешем, данные никуда не отправляются. После переезда сайта на сервер
          кабинет станет полноценным: вход с любого устройства и Яндекс ID.
        </p>
      </div>
    </>
  );
}
