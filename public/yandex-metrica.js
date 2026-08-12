(() => {
  const id = 110907002;
  window.ym = window.ym || function () {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = Date.now();

  const src = `https://mc.yandex.ru/metrika/tag.js?id=${id}`;
  if (!Array.from(document.scripts).some((script) => script.src === src)) {
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = src;
    document.head.appendChild(tag);
  }

  window.ym(id, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
})();
