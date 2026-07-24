/*
  Блокировка прокрутки фона под шторкой, корзиной и модалкой.

  Само по себе `body { overflow: hidden }` убирает полосу прокрутки, страница
  становится шире на её ширину, и весь макет дёргается вбок в момент открытия —
  и обратно при закрытии. Это заметный сдвиг, и он же портит CLS. Поэтому
  ширина полосы компенсируется отступом.

  Счётчик нужен на случай, когда открыто больше одного слоя (корзина поверх
  шторки фильтров): закрытие верхнего не должно разблокировать фон под нижним.
*/

let locks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function lockScroll() {
  if (typeof document === "undefined") return;
  if (locks++ > 0) return;

  const { body } = document;
  const gap = window.innerWidth - document.documentElement.clientWidth;

  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;

  body.style.overflow = "hidden";
  if (gap > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + gap}px`;
  }
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  if (locks === 0) return;
  if (--locks > 0) return;

  const { body } = document;
  body.style.overflow = savedOverflow;
  body.style.paddingRight = savedPaddingRight;
}
