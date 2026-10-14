"use client";
export function CookieSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("momo:cookie-settings"))}
    className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Настройки cookie</button>;
}
