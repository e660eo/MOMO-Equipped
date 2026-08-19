import type {
  DealerLocation,
  DealerLocationKind,
  DealerOfficialStatus,
} from "./types";

export const DEALER_LOCATION_KINDS: DealerLocationKind[] = ["store", "installation", "store_install"];

export const DEALER_LOCATION_KIND_LABELS: Record<DealerLocationKind, string> = {
  store: "Магазин",
  installation: "Установочный центр",
  store_install: "Магазин / Установочный центр",
};

export const DEALER_OFFICIAL_STATUSES: DealerOfficialStatus[] = [
  "dealer",
  "representative",
];

export const DEALER_OFFICIAL_STATUS_LABELS: Record<DealerOfficialStatus, string> = {
  dealer: "Официальный дилер",
  representative: "Официальный представитель",
};

export function dealerOfficialStatus(dealer: DealerLocation): DealerOfficialStatus {
  return dealer.officialStatus && DEALER_OFFICIAL_STATUSES.includes(dealer.officialStatus)
    ? dealer.officialStatus
    : "dealer";
}

export function dealerLocationKind(dealer: DealerLocation): DealerLocationKind {
  if (dealer.kind && DEALER_LOCATION_KINDS.includes(dealer.kind)) return dealer.kind;
  return dealer.authorizedInstallation ? "store_install" : "store";
}

export function dealerSupportsSales(dealer: DealerLocation): boolean {
  return dealerLocationKind(dealer) !== "installation";
}

export function dealerSupportsInstallation(dealer: DealerLocation): boolean {
  return dealerLocationKind(dealer) !== "store";
}
