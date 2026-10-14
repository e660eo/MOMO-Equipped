(() => {
  // Повторная проверка в загрузчике закрывает гонку при отзыве согласия.
  let choice;
  try { choice = JSON.parse(localStorage.getItem("momo-cookie-consent") || "null"); } catch { return; }
  if (choice?.accepted !== true || choice.version !== "2026-10-14") return;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const src = "https://mc.yandex.ru/metrika/tag.js?id=110907002";
  if (!Array.from(document.scripts).some(script => script.src === src)) {
    const tag = document.createElement("script"); tag.async = true; tag.src = src; document.head.appendChild(tag);
  }
})();
