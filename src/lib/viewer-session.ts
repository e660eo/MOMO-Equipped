import type { DealerAccount, DealerLocation, PublicCustomer } from "./types";

/** Минимум данных дилера, который безопасно показывать в шапке сайта. */
export interface PublicDealerSession {
  contactName: string;
  company: string;
  city: string;
}

export function toPublicDealerSession(
  session: {
    account: Pick<DealerAccount, "contactName">;
    dealer: Pick<DealerLocation, "name" | "city">;
  } | null,
): PublicDealerSession | null {
  if (!session) return null;
  return {
    contactName: session.account.contactName,
    company: session.dealer.name,
    city: session.dealer.city,
  };
}

/** Дилерская сессия приоритетнее, если в браузере осталась и покупательская. */
export function accountDestination(
  customer: PublicCustomer | null,
  dealer: PublicDealerSession | null,
): "/dealer" | "/profile" | null {
  if (dealer) return "/dealer";
  if (customer) return "/profile";
  return null;
}
