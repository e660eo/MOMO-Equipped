"use client";

import { useEffect } from "react";
import { LogIn } from "lucide-react";
import { useAccount } from "@/lib/account-store";

/** Открывает ту же форму, которой пользуются обычные покупатели. */
export function DealerLoginPrompt() {
  const openModal = useAccount((state) => state.openModal);

  useEffect(() => {
    openModal();
  }, [openModal]);

  return (
    <button
      type="button"
      onClick={() => openModal()}
      className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5500] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,85,0,.22)] transition hover:bg-[#ff6a1f] active:scale-[.99]"
    >
      <LogIn size={18} /> Войти через личный кабинет
    </button>
  );
}
