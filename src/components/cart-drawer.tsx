"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  Minus,
  Plus,
  Trash2,
  Truck,
  MapPin,
  LocateFixed,
  Search,
} from "lucide-react";
import { useCart, cartTotal } from "@/lib/cart-store";
import { formatPrice, productImageUrl } from "@/lib/format";
import { useSiteConfig } from "@/components/site-config-provider";
import { useCustomer } from "@/components/customer-provider";
import { useAccount } from "@/lib/account-store";
import { isPhoneComplete } from "@/lib/phone";
import {
  submitOrder,
  checkPromo,
  loadOzonPickupMap,
  searchPickupPlace,
  selectOzonPickup,
} from "@/app/order-actions";
import type { PublicPlaceResult } from "@/lib/place-search";
import type {
  OzonDeliverySelection,
  PublicOzonCluster,
  PublicOzonPoint,
} from "@/lib/ozon-delivery";
import { ProductImage } from "./product-image";
import { PhoneInput } from "./phone-input";
import { ConsentCheckbox } from "./consent-checkbox";
import { cn } from "@/lib/utils";
import { YandexSplitBadge } from "./yandex-split-badge";
import type { MapTarget, MapView } from "./ozon-pickup-map";

const OzonPickupMap = dynamic(
  () => import("./ozon-pickup-map").then((module) => module.OzonPickupMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[360px] place-items-center bg-tile font-mono text-xs text-muted-foreground sm:h-[440px]">
        Р—Р°РіСЂСѓР¶Р°РµРј РєР°СЂС‚СѓвЂ¦
      </div>
    ),
  },
);

// Р”Р°РЅРЅС‹Рµ РїРѕР»СѓС‡Р°С‚РµР»СЏ Р·Р°РїРѕРјРёРЅР°РµРј вЂ” РїСЂРё РїРѕРІС‚РѕСЂРЅРѕРј Р·Р°РєР°Р·Рµ РЅРµ РІРІРѕРґРёС‚СЊ Р·Р°РЅРѕРІРѕ.
const RECIPIENT_KEY = "momo-recipient";

// text-base РЅР° СѓР·РєРѕРј СЌРєСЂР°РЅРµ: РїСЂРё С€СЂРёС„С‚Рµ РјРµРЅСЊС€Рµ 16px Safari РЅР° iPhone
// РїСЂРёР±Р»РёР¶Р°РµС‚ СЃС‚СЂР°РЅРёС†Сѓ, РєР°Рє С‚РѕР»СЊРєРѕ С‡РµР»РѕРІРµРє СЃС‚Р°РІРёС‚ РєСѓСЂСЃРѕСЂ РІ РїРѕР»Рµ, Рё РѕР±СЂР°С‚РЅРѕ
// СѓР¶Рµ РЅРµ РѕС‚РґР°Р»СЏРµС‚. РЎРј. С‚РѕС‚ Р¶Рµ РєРѕРјРјРµРЅС‚Р°СЂРёР№ РІ catalog-view.tsx.
const inputCls =
  "w-full rounded-sm border border-input bg-background px-3.5 py-3 text-base text-foreground transition-colors focus:border-signal focus:outline-none sm:text-sm";
const labelCls =
  "mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground";

const cityCenters: Record<string, Omit<MapTarget, "zoom">> = {
  "РњР°С…Р°С‡РєР°Р»Р°": { lat: 42.9849, long: 47.5047 },
  "РњРѕСЃРєРІР°": { lat: 55.7558, long: 37.6176 },
  "РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРі": { lat: 59.9343, long: 30.3351 },
  "РљСЂР°СЃРЅРѕРґР°СЂ": { lat: 45.0355, long: 38.9753 },
  "Р РѕСЃС‚РѕРІ-РЅР°-Р”РѕРЅСѓ": { lat: 47.2357, long: 39.7015 },
  "РљР°Р·Р°РЅСЊ": { lat: 55.7961, long: 49.1064 },
  "Р•РєР°С‚РµСЂРёРЅР±СѓСЂРі": { lat: 56.8389, long: 60.6057 },
  "РќРѕРІРѕСЃРёР±РёСЂСЃРє": { lat: 55.0084, long: 82.9357 },
};
const russiaMapTarget: MapTarget = { lat: 61.2, long: 89.2, zoom: 2 };

export function CartPageClient() {
  const { items, setQty, remove, clear } = useCart();
  const customer = useCustomer();
  const openAuth = useAccount((s) => s.openModal);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");
  const [sending, setSending] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(
    null,
  );
  const [promoMsg, setPromoMsg] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [points, setPoints] = useState<PublicOzonPoint[]>([]);
  const [clusters, setClusters] = useState<PublicOzonCluster[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PublicOzonPoint | null>(null);
  const [delivery, setDelivery] = useState<OzonDeliverySelection | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [deliveryMsg, setDeliveryMsg] = useState("");
  const [mapTarget, setMapTarget] = useState<MapTarget>(russiaMapTarget);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PublicPlaceResult[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const mapRequestRef = useRef(0);
  const lastMapViewRef = useRef<MapView | null>(null);
  const deliveryPickerRef = useRef<HTMLDivElement>(null);
  const payButtonRef = useRef<HTMLButtonElement>(null);

  // РџРѕРґСЃС‚Р°РІР»СЏРµРј СЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ РїРѕР»СѓС‡Р°С‚РµР»СЏ РїСЂРё РїРµСЂРІРѕРј РѕС‚РєСЂС‹С‚РёРё
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECIPIENT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.name) setName(d.name);
      if (d.phone) setPhone(d.phone);
      if (d.address) setAddress(d.address);
    } catch {}
  }, []);

  // Р•СЃР»Рё РіРѕСЂРѕРґ РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ РІС‹Р±РёСЂР°Р»Рё РІ С€Р°РїРєРµ, РЅР°С‡РёРЅР°РµРј СЃ РЅРµРіРѕ. Р‘РµР· СЃРѕС…СЂР°РЅС‘РЅРЅРѕРіРѕ
  // РІС‹Р±РѕСЂР° РїРѕРєР°Р·С‹РІР°РµРј РІСЃСЋ Р РѕСЃСЃРёСЋ вЂ” РєР°СЂС‚Р° Р±РѕР»СЊС€Рµ РЅРµ РїСЂРёРІСЏР·Р°РЅР° Рє РњР°С…Р°С‡РєР°Р»Рµ.
  useEffect(() => {
    const city = localStorage.getItem("momo-city");
    const center = city ? cityCenters[city] : undefined;
    if (center) setMapTarget({ ...center, zoom: 11 });
  }, []);

  const { contacts, trust, payEnabled, paySandbox } = useSiteConfig();
  const total = cartTotal(items);
  const freeFrom = trust.freeShippingFrom;

  // РЎРєРёРґРєР° РїРѕ РїСЂРѕРјРѕРєРѕРґСѓ. РџСЂРѕС†РµРЅС‚ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ СЃРµСЂРІРµСЂ (checkPromo), РЅРѕ РЅР°СЃС‚РѕСЏС‰СѓСЋ
  // РїСЂРѕРІРµСЂРєСѓ Рё СЃРїРёСЃР°РЅРёРµ РґРµР»Р°РµС‚ submitOrder вЂ” Р·РґРµСЃСЊ С‚РѕР»СЊРєРѕ РїРѕРєР°Р·.
  const discount = promo ? Math.round((total * promo.percent) / 100) : 0;
  const payable = total - discount;
  const deliveryCharge = delivery?.customerPrice ?? 0;
  const payableWithDelivery = payable + deliveryCharge;
  // Р‘РµСЃРїР»Р°С‚РЅР°СЏ РѕРЅР»Р°Р№РЅ-РґРѕСЃС‚Р°РІРєР° СЃС‡РёС‚Р°РµС‚СЃСЏ РѕС‚ СЃСѓРјРјС‹, РєРѕС‚РѕСЂСѓСЋ СЂРµР°Р»СЊРЅРѕ Р·Р°РїР»Р°С‚СЏС‚.
  const remaining = Math.max(0, freeFrom - payable);
  const shippingPct = Math.min(100, (payable / freeFrom) * 100);

  useEffect(() => {
    setDelivery(null);
  }, [phone, items]);

  async function loadMapArea(view: MapView) {
    lastMapViewRef.current = view;
    if (view.zoom < 5) {
      mapRequestRef.current += 1;
      setMapBusy(false);
      setPoints([]);
      setClusters([]);
      setDeliveryMsg("РќР°Р№РґРёС‚Рµ СЃРІРѕР№ РіРѕСЂРѕРґ РёР»Рё РїСЂРёР±Р»РёР·СЊС‚Рµ РЅСѓР¶РЅСѓСЋ РѕР±Р»Р°СЃС‚СЊ РєР°СЂС‚С‹.");
      return;
    }
    const requestId = ++mapRequestRef.current;
    setMapBusy(true);
    const result = await loadOzonPickupMap({
      viewport: view.viewport,
      zoom: view.zoom,
    });
    if (requestId !== mapRequestRef.current) return;
    setMapBusy(false);
    if (!result.ok) {
      setDeliveryMsg(result.error);
      return;
    }
    setPoints(result.area.points);
    setClusters(result.area.clusters);
    if (!result.area.points.length && !result.area.clusters.length) {
      setDeliveryMsg("Р’ СЌС‚РѕР№ РѕР±Р»Р°СЃС‚Рё РїСѓРЅРєС‚С‹ Ozon РЅРµ РЅР°Р№РґРµРЅС‹. РџРµСЂРµРјРµСЃС‚РёС‚Рµ РєР°СЂС‚Сѓ.");
    } else if (result.area.clusters.length) {
      setDeliveryMsg("РќР°Р¶РјРёС‚Рµ РЅР° СЃРёРЅСЋСЋ РіСЂСѓРїРїСѓ РџР’Р—, С‡С‚РѕР±С‹ РїСЂРёР±Р»РёР·РёС‚СЊ РєР°СЂС‚Сѓ.");
    } else {
      setDeliveryMsg("Р’С‹Р±РµСЂРёС‚Рµ СЃРёРЅСЋСЋ РјРµС‚РєСѓ РёР»Рё Р°РґСЂРµСЃ РїРѕРґ РєР°СЂС‚РѕР№.");
    }
  }

  async function locatePickupPoints() {
    if (!("geolocation" in navigator)) {
      setDeliveryMsg("РџРµСЂРµРјРµСЃС‚РёС‚Рµ РєР°СЂС‚Сѓ РІ СЃРІРѕР№ РіРѕСЂРѕРґ Рё РЅР°Р¶РјРёС‚Рµ В«РџРѕРєР°Р·Р°С‚СЊ РџР’Р— Р·РґРµСЃСЊВ».");
      return;
    }
    setDeliveryBusy(true);
    setDeliveryMsg("Р Р°Р·СЂРµС€РёС‚Рµ РґРѕСЃС‚СѓРї Рє РіРµРѕРїРѕР·РёС†РёРё вЂ” РїРѕРєР°Р¶РµРј Р±Р»РёР¶Р°Р№С€РёРµ РџР’Р— Ozon.");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setDeliveryBusy(false);
        setMapTarget({ lat: coords.latitude, long: coords.longitude, zoom: 13 });
        setDeliveryMsg("РџРѕРєР°Р·С‹РІР°РµРј РїСѓРЅРєС‚С‹ Ozon СЂСЏРґРѕРј СЃ РІР°РјРёвЂ¦");
      },
      () => {
        setDeliveryBusy(false);
        setDeliveryMsg("Р”РѕСЃС‚СѓРї РЅРµ РЅСѓР¶РµРЅ: РїРµСЂРµРјРµСЃС‚РёС‚Рµ РєР°СЂС‚Сѓ РІ СЃРІРѕР№ РіРѕСЂРѕРґ Рё РЅР°Р¶РјРёС‚Рµ В«РџРѕРєР°Р·Р°С‚СЊ РџР’Р— Р·РґРµСЃСЊВ».");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  }

  async function findPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (placeQuery.trim().length < 2) {
      setDeliveryMsg("Р’РІРµРґРёС‚Рµ РіРѕСЂРѕРґ, СѓР»РёС†Сѓ РёР»Рё Р°РґСЂРµСЃ.");
      return;
    }
    setPlaceBusy(true);
    setPlaceResults([]);
    const result = await searchPickupPlace(placeQuery);
    setPlaceBusy(false);
    if (!result.ok) {
      setDeliveryMsg(result.error);
      return;
    }
    setPlaceResults(result.places);
    setDeliveryMsg("Р’С‹Р±РµСЂРёС‚Рµ РїРѕРґС…РѕРґСЏС‰РёР№ Р°РґСЂРµСЃ РёР· СЃРїРёСЃРєР°.");
  }

  function choosePlace(place: PublicPlaceResult) {
    setPlaceQuery(place.label);
    setPlaceResults([]);
    setMapTarget({ lat: place.lat, long: place.long, zoom: place.zoom });
    setSelectedPoint(null);
    setDelivery(null);
    setDeliveryMsg("Р—Р°РіСЂСѓР¶Р°РµРј РїСѓРЅРєС‚С‹ Ozon РІ РІС‹Р±СЂР°РЅРЅРѕР№ РѕР±Р»Р°СЃС‚РёвЂ¦");
  }

  async function confirmPickup() {
    if (!selectedPoint) return;
    if (!isPhoneComplete(phone)) {
      setDeliveryMsg("РЎРЅР°С‡Р°Р»Р° СѓРєР°Р¶РёС‚Рµ РїРѕР»РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°.");
      return;
    }
    setDeliveryBusy(true);
    setDeliveryMsg("");
    const result = await selectOzonPickup({
      phone,
      pointId: selectedPoint.id,
      items: items.map((item) => ({ slug: item.slug, qty: item.qty })),
    });
    setDeliveryBusy(false);
    if (!result.ok) {
      setDelivery(null);
      setDeliveryMsg(result.error);
      return;
    }
    setDelivery(result.delivery);
    setAddress(`РџР’Р— Ozon: ${result.delivery.point.address}`);
    setDeliveryMsg("РџР’Р— РІС‹Р±СЂР°РЅ. РўРµРїРµСЂСЊ РјРѕР¶РЅРѕ РїРµСЂРµР№С‚Рё Рє РѕРїР»Р°С‚Рµ.");
    requestAnimationFrame(() =>
      payButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg("");
    const res = await checkPromo(code, total);
    setPromoBusy(false);
    if (res.ok) {
      setPromo({ code: res.code, percent: res.percent });
      setPromoInput(res.code);
    } else {
      setPromo(null);
      setPromoMsg(res.error);
    }
  }
  function removePromo() {
    setPromo(null);
    setPromoInput("");
    setPromoMsg("");
  }

  async function submit(pay = false) {
    if (pay && !customer) {
      setError("Р”Р»СЏ РѕРїР»Р°С‚С‹ РЅР° СЃР°Р№С‚Рµ РІРѕР№РґРёС‚Рµ РёР»Рё Р·Р°СЂРµРіРёСЃС‚СЂРёСЂСѓР№С‚РµСЃСЊ.");
      openAuth("checkout");
      return;
    }
    if (pay && !delivery) {
      setError("");
      if (!points.length && !clusters.length && !mapBusy && lastMapViewRef.current) {
        void loadMapArea(lastMapViewRef.current);
      }
      requestAnimationFrame(() =>
        deliveryPickerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Р—Р°РїРѕР»РЅРёС‚Рµ Р¤РРћ, С‚РµР»РµС„РѕРЅ Рё Р°РґСЂРµСЃ РґРѕСЃС‚Р°РІРєРё.");
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError("РџСЂРѕРІРµСЂСЊС‚Рµ С‚РµР»РµС„РѕРЅ вЂ” РІ РЅРѕРјРµСЂРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ 10 С†РёС„СЂ РїРѕСЃР»Рµ +7.");
      return;
    }
    // РЎРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РџР” РЅРµ Р·Р°РїРѕРјРёРЅР°РµРј вЂ” РµРіРѕ РґР°СЋС‚ Р·Р°РЅРѕРІРѕ РЅР° РєР°Р¶РґС‹Р№ Р·Р°РєР°Р·.
    if (!consent) {
      setError("РћС‚РјРµС‚СЊС‚Рµ СЃРѕРіР»Р°СЃРёРµ РЅР° РѕР±СЂР°Р±РѕС‚РєСѓ РїРµСЂСЃРѕРЅР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С….");
      return;
    }
    setError("");
    setSending(true);

    /*
      РЎРЅР°С‡Р°Р»Р° СЃРѕС…СЂР°РЅСЏРµРј Р·Р°РєР°Р· РЅР° СЃРµСЂРІРµСЂРµ. WhatsApp-Р·Р°СЏРІРєР° СЃСЂР°Р·Сѓ РїРѕСЏРІР»СЏРµС‚СЃСЏ РІ
      РїР°РЅРµР»Рё; РѕРЅР»Р°Р№РЅ-Р·Р°РїРёСЃСЊ РѕСЃС‚Р°С‘С‚СЃСЏ СЃРєСЂС‹С‚РѕР№ РґРѕ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕР№ РѕРїР»Р°С‚С‹.

      Р•СЃР»Рё РѕР±С‹С‡РЅСѓСЋ WhatsApp-Р·Р°СЏРІРєСѓ СЃРѕС…СЂР°РЅРёС‚СЊ РЅРµ СѓРґР°Р»РѕСЃСЊ, СЃРѕСЃС‚Р°РІ РІСЃС‘ СЂР°РІРЅРѕ
      РѕС‚РєСЂРѕРµС‚СЃСЏ РІ РїРµСЂРµРїРёСЃРєРµ. РћРЅР»Р°Р№РЅ-РїР»Р°С‚С‘Р¶ Р±РµР· СЃРµСЂРІРµСЂРЅРѕР№ Р·Р°РїРёСЃРё РЅРµ РЅР°С‡РёРЅР°РµРј.
    */
    const saved = await submitOrder({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      comment: comment.trim(),
      items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
      pay,
      ...(promo ? { promoCode: promo.code } : {}),
      ...(pay && delivery ? { deliveryToken: delivery.token } : {}),
    });
    setSending(false);
    const orderNumber = saved.ok ? saved.id : null;

    if (pay && !saved.ok) {
      setError(saved.error);
      if (saved.requiresAuth) openAuth("checkout");
      return;
    }

    /*
      РћРїР»Р°С‚Р° РЅР° СЃР°Р№С‚Рµ: СѓРІРѕРґРёРј РЅР° С„РѕСЂРјСѓ РЇРЅРґРµРєСЃР° С‚РµРј Р¶Рµ РїРµСЂРµС…РѕРґРѕРј, Р±РµР· РЅРѕРІРѕРіРѕ
      РѕРєРЅР° вЂ” РїР»Р°С‚С‘Р¶РЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ Р±СЂР°СѓР·РµСЂС‹ Рё Р±Р»РѕРєРёСЂРѕРІС‰РёРєРё Р»СЋР±СЏС‚ РїСЂРёРґРµСЂР¶Р°С‚СЊ,
      Р° РїСЂРѕРїР°РІС€Р°СЏ РѕРїР»Р°С‚Р° РІС‹РіР»СЏРґРёС‚ РєР°Рє РїРѕР»РѕРјРєР° РјР°РіР°Р·РёРЅР°.

      Р›РѕРєР°Р»СЊРЅСѓСЋ РєРІРёС‚Р°РЅС†РёСЋ С‚СѓС‚ РЅРµ РїРёС€РµРј: Р·Р°РєР°Р· СѓР¶Рµ РЅР° СЃРµСЂРІРµСЂРµ, Р° РІ РєР°Р±РёРЅРµС‚Рµ РѕРЅ
      РїРѕСЏРІРёС‚СЃСЏ СЃ РЅР°СЃС‚РѕСЏС‰РёРј СЃС‚Р°С‚СѓСЃРѕРј РѕРїР»Р°С‚С‹.
    */
    if (pay && saved.ok && saved.paymentUrl) {
      // Р—Р°РїРѕРјРёРЅР°РµРј РїРѕР»СѓС‡Р°С‚РµР»СЏ РґРѕ СѓС…РѕРґР° СЃРѕ СЃС‚СЂР°РЅРёС†С‹
      try {
        localStorage.setItem(
          RECIPIENT_KEY,
          JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
        );
      } catch {}
      window.location.href = saved.paymentUrl;
      return;
    }

    // РџСЂРѕСЃРёР»Рё РѕРїР»Р°С‚Сѓ, Р° СЃСЃС‹Р»РєРё РЅРµС‚. РўРµС…РЅРёС‡РµСЃРєР°СЏ Р·Р°РіРѕС‚РѕРІРєР° СЃРєСЂС‹С‚Р° РѕС‚ РїР°РЅРµР»Рё;
    // РЅРѕРІСѓСЋ РїРѕРїС‹С‚РєСѓ РЅР°С‡РёРЅР°РµРј Р·Р°РЅРѕРІРѕ, С‡С‚РѕР±С‹ РЅРµ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЃС‚Р°СЂСѓСЋ СЃРµСЃСЃРёСЋ.
    if (pay) {
      setError(
        "РЇРЅРґРµРєСЃ Pay РЅРµ СЃРѕР·РґР°Р» РЅРѕРІСѓСЋ СЃСЃС‹Р»РєСѓ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р· С‡РµСЂРµР· РјРёРЅСѓС‚Сѓ.",
      );
      return;
    }

    // Р—Р°РїРѕРјРёРЅР°РµРј РїРѕР»СѓС‡Р°С‚РµР»СЏ РґР»СЏ СЃР»РµРґСѓСЋС‰РµРіРѕ Р·Р°РєР°Р·Р°
    try {
      localStorage.setItem(
        RECIPIENT_KEY,
        JSON.stringify({ name: name.trim(), phone, address: address.trim() }),
      );
    } catch {}
    const lines = [
      orderNumber ? `Р—Р°РєР°Р· в„–${orderNumber} СЃ СЃР°Р№С‚Р° MOMO:` : "Р—Р°РєР°Р· СЃ СЃР°Р№С‚Р° MOMO:",
      ...items.map(
        (i) => `вЂў ${i.title} вЂ” ${i.qty} С€С‚. Г— ${formatPrice(i.price)}`,
      ),
      ...(promo
        ? [`РџСЂРѕРјРѕРєРѕРґ ${promo.code}: в€’${promo.percent}% (в€’${formatPrice(discount)})`]
        : []),
      `РС‚РѕРіРѕ: ${formatPrice(payable)}`,
      "",
      `РџРѕР»СѓС‡Р°С‚РµР»СЊ: ${name.trim()}`,
      `РўРµР»РµС„РѕРЅ: ${phone.trim()}`,
      `РђРґСЂРµСЃ: ${address.trim()}`,
      comment.trim() ? `РљРѕРјРјРµРЅС‚Р°СЂРёР№: ${comment.trim()}` : "",
    ].filter(Boolean);
    const url = `${contacts.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
    /*
      РќРѕРјРµСЂ РїРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ РЅР°СЃС‚РѕСЏС‰РёР№, СЃ СЃРµСЂРІРµСЂР°. Р Р°РЅСЊС€Рµ РїСЂРё РЅРµСѓРґР°С‡РЅРѕРј
      СЃРѕС…СЂР°РЅРµРЅРёРё РїРѕРґСЃС‚Р°РІР»СЏР»СЃСЏ РІС‹РґСѓРјР°РЅРЅС‹Р№ Р»РѕРєР°Р»СЊРЅС‹Р№ В«MO-вЂ¦В», РєРѕС‚РѕСЂРѕРіРѕ РјР°РіР°Р·РёРЅ
      РЅРёРєРѕРіРґР° РЅРµ РІРёРґРµР», вЂ” РїРѕРєСѓРїР°С‚РµР»СЊ РЅР°Р·С‹РІР°Р» РјРµРЅРµРґР¶РµСЂСѓ РЅРѕРјРµСЂ, Р° С‚РѕС‚ РµРіРѕ РЅРµ
      РЅР°С…РѕРґРёР». Р‘РµР· РЅРѕРјРµСЂР° Р·Р°РєР°Р· РІСЃС‘ СЂР°РІРЅРѕ СѓС…РѕРґРёС‚ РІ WhatsApp РїРѕР»РЅС‹Рј СЃРѕСЃС‚Р°РІРѕРј.
    */
    setLastOrderId(orderNumber ?? "");
    setSent(true);
    setConsent(false);
    clear();
  }

  return (
    <main className="min-h-[70vh] bg-bg py-7 sm:py-12">
      <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6">
        <Link
          href="/catalog"
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-signal"
        >
          <ArrowLeft size={15} />
          РџСЂРѕРґРѕР»Р¶РёС‚СЊ РїРѕРєСѓРїРєРё
        </Link>
        <div className="mb-7 flex items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-signal">
              РћС„РѕСЂРјР»РµРЅРёРµ Р·Р°РєР°Р·Р°
            </p>
            <h1 className="font-display text-2xl font-semibold uppercase sm:text-4xl">
              РљРѕСЂР·РёРЅР°
            </h1>
          </div>
          {items.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {items.reduce((sum, item) => sum + item.qty, 0)} С€С‚.
            </span>
          )}
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Р—Р°РєР°Р· {lastOrderId && <b className="font-mono">{lastOrderId}</b>}{" "}
              СЃС„РѕСЂРјРёСЂРѕРІР°РЅ Рё РѕС‚РєСЂС‹С‚ РІ WhatsApp вЂ” РѕС‚РїСЂР°РІСЊС‚Рµ СЃРѕРѕР±С‰РµРЅРёРµ, Рё РјРµРЅРµРґР¶РµСЂ
              РїРѕРґС‚РІРµСЂРґРёС‚ Р·Р°РєР°Р· РІ С‚РµС‡РµРЅРёРµ СЂР°Р±РѕС‡РµРіРѕ РґРЅСЏ.
            </p>
            <p className="font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
              РљРѕРїРёСЏ Р·Р°РєР°Р·Р° вЂ” РІ{" "}
              <a
                href="/profile"
                className="text-[var(--signal-text)] underline underline-offset-2 hover:no-underline"
              >
                Р»РёС‡РЅРѕРј РєР°Р±РёРЅРµС‚Рµ
              </a>{" "}
              РЅР° СЌС‚РѕРј СѓСЃС‚СЂРѕР№СЃС‚РІРµ.
            </p>
            <Link
              href="/catalog"
              onClick={() => setSent(false)}
              className="block w-full rounded-sm border border-border py-3 text-center text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Р’РµСЂРЅСѓС‚СЊСЃСЏ Рє РїРѕРєСѓРїРєР°Рј
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Р’ РєРѕСЂР·РёРЅРµ РїРѕРєР° РїСѓСЃС‚Рѕ. Р”РѕР±Р°РІСЊС‚Рµ С‚РѕРІР°СЂС‹ РёР· РєР°С‚Р°Р»РѕРіР° вЂ” РѕРЅРё РїРѕСЏРІСЏС‚СЃСЏ
              Р·РґРµСЃСЊ.
            </p>
            <Link
              href="/catalog"
              className="inline-flex rounded-sm bg-signal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f]"
            >
              РћС‚РєСЂС‹С‚СЊ РєР°С‚Р°Р»РѕРі
            </Link>
          </div>
        ) : (
          <>
            <ul>
              {items.map((i) => (
                <li
                  key={i.slug}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3.5 border-b border-border py-3.5"
                >
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-sm border border-border bg-tile">
                    <ProductImage
                      src={productImageUrl(i.image)}
                      alt=""
                      sizes="96px"
                      className="h-[85%] w-[85%] object-contain mix-blend-multiply"
                    />
                  </span>
                  <span>
                    <span className="block text-[0.84rem] font-medium leading-snug">
                      {i.title}
                    </span>
                    {/*
                      РљСЂСѓР¶РєРё Р±С‹Р»Рё РїРѕ 24px вЂ” РїРѕРїР°СЃС‚СЊ РїР°Р»СЊС†РµРј РјРѕР¶РЅРѕ С‚РѕР»СЊРєРѕ СЃРѕ
                      РІС‚РѕСЂРѕРіРѕ СЂР°Р·Р°. Р’РёРґРёРјС‹Р№ СЂР°Р·РјРµСЂ РѕСЃС‚Р°РІР»СЏРµРј РїСЂРµР¶РЅРёРј, Р° РѕР±Р»Р°СЃС‚СЊ
                      РЅР°Р¶Р°С‚РёСЏ СЂР°СЃС‚СЏРіРёРІР°РµРј РїСЃРµРІРґРѕСЌР»РµРјРµРЅС‚РѕРј РґРѕ 44px: СЂР°Р·РјРµС‚РєР° РѕС‚
                      СЌС‚РѕРіРѕ РЅРµ СЂР°СЃС…РѕРґРёС‚СЃСЏ.
                    */}
                    <span className="mt-1.5 inline-flex items-center gap-2">
                      <button
                        aria-label="РЈР±Р°РІРёС‚СЊ"
                        onClick={() => setQty(i.slug, i.qty - 1)}
                        className="tap-44 relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-4 text-center font-mono text-xs tabular-nums">
                        {i.qty}
                      </span>
                      <button
                        aria-label="РџСЂРёР±Р°РІРёС‚СЊ"
                        onClick={() => setQty(i.slug, i.qty + 1)}
                        className="tap-44 relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-signal hover:text-signal"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        aria-label="РЈРґР°Р»РёС‚СЊ РёР· РєРѕСЂР·РёРЅС‹"
                        onClick={() => remove(i.slug)}
                        className="tap-44 relative ml-1 inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-signal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </span>
                  <span className="font-display text-sm font-semibold">
                    {formatPrice(i.price * i.qty)}
                  </span>
                </li>
              ))}
            </ul>

            {/* РџСЂРѕРіСЂРµСЃСЃ РґРѕ Р±РµСЃРїР»Р°С‚РЅРѕР№ РґРѕСЃС‚Р°РІРєРё */}
            <div className="mt-5 rounded-xl border border-border bg-bg p-4">
              {remaining > 0 ? (
                <p className="text-[0.82rem]">
                  Р”Рѕ Р±РµСЃРїР»Р°С‚РЅРѕР№ РґРѕСЃС‚Р°РІРєРё{" "}
                  <b className="font-semibold text-[var(--signal-text)]">
                    {formatPrice(remaining)}
                  </b>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-[0.82rem] font-semibold text-[var(--signal-text)]">
                  <Truck size={15} />
                  Р”РѕСЃС‚Р°РІРєР° Р±РµСЃРїР»Р°С‚РЅРѕ
                </p>
              )}
              <div
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={Math.round(shippingPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="РџСЂРѕРіСЂРµСЃСЃ РґРѕ Р±РµСЃРїР»Р°С‚РЅРѕР№ РґРѕСЃС‚Р°РІРєРё"
              >
                <div
                  className="h-full rounded-full bg-signal transition-[width] duration-500"
                  style={{ width: `${shippingPct}%` }}
                />
              </div>
            </div>

            <p className="mb-4 mt-6 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
              Р”Р°РЅРЅС‹Рµ РїРѕР»СѓС‡Р°С‚РµР»СЏ
            </p>
            <div className="space-y-3.5">
              <div>
                <label className={labelCls} htmlFor="rc-name">
                  Р¤РРћ
                </label>
                <input
                  id="rc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Р¤Р°РјРёР»РёСЏ РРјСЏ РћС‚С‡РµСЃС‚РІРѕ"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-phone">
                  РўРµР»РµС„РѕРЅ
                </label>
                <PhoneInput
                  id="rc-phone"
                  value={phone}
                  onChange={setPhone}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-addr">
                  РђРґСЂРµСЃ РґРѕСЃС‚Р°РІРєРё
                </label>
                <textarea
                  id="rc-addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  autoComplete="street-address"
                  placeholder="Р“РѕСЂРѕРґ, СѓР»РёС†Р°, РґРѕРј, РєРІР°СЂС‚РёСЂР°"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rc-comment">
                  РљРѕРјРјРµРЅС‚Р°СЂРёР№ Рє Р·Р°РєР°Р·Сѓ
                </label>
                <textarea
                  id="rc-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="РќРµРѕР±СЏР·Р°С‚РµР»СЊРЅРѕ"
                  className={inputCls}
                />
              </div>
              {payEnabled && (
                <div
                  ref={deliveryPickerRef}
                  className="overflow-hidden rounded-2xl border border-signal/50 bg-signal/5"
                >
                  <div className="border-b border-border bg-surface p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin size={16} className="text-[#005bff]" />
                          РџСѓРЅРєС‚С‹ Ozon РїРѕ РІСЃРµР№ Р РѕСЃСЃРёРё
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          РќР°Р№РґРёС‚Рµ РіРѕСЂРѕРґ РёР»Рё Р°РґСЂРµСЃ Р»РёР±Рѕ РїСЂРёР±Р»РёР·СЊС‚Рµ РЅСѓР¶РЅСѓСЋ РѕР±Р»Р°СЃС‚СЊ РєР°СЂС‚С‹.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={locatePickupPoints}
                          disabled={deliveryBusy || mapBusy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-[#005bff] hover:text-[#005bff] disabled:opacity-60 sm:flex-none"
                        >
                          <LocateFixed size={14} />
                          Р СЏРґРѕРј СЃРѕ РјРЅРѕР№
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMapTarget(russiaMapTarget);
                            setPlaceResults([]);
                            setDeliveryMsg("РџРѕРєР°Р·С‹РІР°РµРј РїСѓРЅРєС‚С‹ Ozon РїРѕ РІСЃРµР№ Р РѕСЃСЃРёРё.");
                          }}
                          className="inline-flex flex-1 items-center justify-center rounded-sm border border-border px-3 py-2 text-xs font-semibold transition-colors hover:border-[#005bff] hover:text-[#005bff] sm:flex-none"
                        >
                          Р’СЃСЏ Р РѕСЃСЃРёСЏ
                        </button>
                      </div>
                    </div>
                    <form onSubmit={findPlace} className="relative mt-3 flex gap-2">
                      <label htmlFor="ozon-place-search" className="sr-only">
                        Р“РѕСЂРѕРґ РёР»Рё Р°РґСЂРµСЃ РґР»СЏ РїРѕРёСЃРєР° РџР’Р— Ozon
                      </label>
                      <div className="relative min-w-0 flex-1">
                        <Search
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          id="ozon-place-search"
                          value={placeQuery}
                          onChange={(event) => {
                            setPlaceQuery(event.target.value);
                            setPlaceResults([]);
                          }}
                          placeholder="РќР°РїСЂРёРјРµСЂ: РњРѕСЃРєРІР°, РўРІРµСЂСЃРєР°СЏ СѓР»РёС†Р°"
                          autoComplete="off"
                          className="w-full rounded-sm border border-input bg-background py-2.5 pl-9 pr-3 text-base outline-none transition-colors focus:border-[#005bff] sm:text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={placeBusy || placeQuery.trim().length < 2}
                        className="rounded-sm bg-[#005bff] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0047c7] disabled:opacity-60"
                      >
                        {placeBusy ? "РС‰РµРјвЂ¦" : "РќР°Р№С‚Рё"}
                      </button>
                    </form>
                    {placeResults.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                        {placeResults.map((place) => (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => choosePlace(place)}
                            className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left text-xs leading-relaxed transition-colors last:border-b-0 hover:bg-[#005bff]/5"
                          >
                            <MapPin size={14} className="mt-0.5 shrink-0 text-[#005bff]" />
                            <span>{place.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <OzonPickupMap
                      target={mapTarget}
                      points={points}
                      clusters={clusters}
                      selectedPointId={selectedPoint?.id}
                      onViewChange={(view) => {
                        setMapTarget({ lat: view.lat, long: view.long, zoom: view.zoom });
                        void loadMapArea(view);
                      }}
                      onSelect={(point) => {
                        setSelectedPoint(point);
                        setDelivery(null);
                        setDeliveryMsg("РџСЂРѕРІРµСЂСЊС‚Рµ Р°РґСЂРµСЃ Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ РІС‹Р±СЂР°РЅРЅС‹Р№ РџР’Р—.");
                      }}
                    />
                    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-[0.68rem] font-semibold text-[#005bff] shadow-md backdrop-blur dark:bg-[#151515]/95">
                      {mapBusy
                        ? "РћР±РЅРѕРІР»СЏРµРј РџР’Р—вЂ¦"
                        : mapTarget.zoom < 5
                          ? "РќР°Р№РґРёС‚Рµ СЃРІРѕР№ РіРѕСЂРѕРґ"
                          : `РќР° РєР°СЂС‚Рµ: ${points.length + clusters.reduce((sum, cluster) => sum + cluster.pointsCount, 0)}`}
                    </div>
                  </div>
                  <div className="bg-surface p-4">
                    {points.length > 0 && (
                      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {points.map((point) => (
                          <button
                            key={point.id}
                            type="button"
                            onClick={() => {
                              setSelectedPoint(point);
                              setDelivery(null);
                              setDeliveryMsg("РџСЂРѕРІРµСЂСЊС‚Рµ Р°РґСЂРµСЃ Рё РїРѕРґС‚РІРµСЂРґРёС‚Рµ РІС‹Р±СЂР°РЅРЅС‹Р№ РџР’Р—.");
                            }}
                            className={cn(
                              "rounded-lg border p-3 text-left text-xs leading-relaxed transition-colors",
                              selectedPoint?.id === point.id
                                ? "border-signal bg-signal/10"
                                : "border-border hover:border-signal/60",
                            )}
                          >
                            <b className="block text-foreground">{point.name}</b>
                            <span className="mt-1 block text-muted-foreground">
                              {point.address} В· {point.distanceKm} РєРј
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedPoint && (
                      <div className="mt-3 rounded-xl border border-border bg-bg p-3 text-sm leading-relaxed">
                        <b>{selectedPoint.name}</b>
                        <span className="mt-1 block text-muted-foreground">
                          {selectedPoint.address}
                        </span>
                        {delivery && (
                          <span className="mt-1 block font-semibold text-[var(--signal-text)]">
                            РџР’Р— РїРѕРґС‚РІРµСЂР¶РґС‘РЅ В· РґРѕСЃС‚Р°РІРєР° Р±РµСЃРїР»Р°С‚РЅРѕ
                          </span>
                        )}
                      </div>
                    )}
                    {!delivery && (
                      <button
                        type="button"
                        onClick={confirmPickup}
                        disabled={deliveryBusy || !selectedPoint}
                        className="mt-3 w-full rounded-sm bg-signal px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff6a1f] disabled:opacity-60"
                      >
                        {deliveryBusy ? "РџСЂРѕРІРµСЂСЏРµРј РјР°СЂС€СЂСѓС‚вЂ¦" : "РџРѕРґС‚РІРµСЂРґРёС‚СЊ РІС‹Р±СЂР°РЅРЅС‹Р№ РџР’Р—"}
                      </button>
                    )}
                    {deliveryMsg && (
                      <p className="mt-2 text-[0.78rem] leading-relaxed text-signal">
                        {deliveryMsg}
                      </p>
                    )}
                    <p className="mt-2 text-[0.72rem] leading-relaxed text-muted-foreground">
                      РўРѕРІР°СЂС‹ РїРµСЂРµРґР°С‘Рј РІ Ozon С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕР№ РѕРїР»Р°С‚С‹.
                    </p>
                  </div>
                </div>
              )}
              {payEnabled && (
                <div className="rounded-xl border border-border bg-bg p-4 text-[0.8rem] leading-relaxed text-muted-foreground">
                  Онлайн-доставка с Ozon доступна для любого чека: если сумма заказа ниже
                  <b className="text-foreground">{formatPrice(freeFrom)}</b>, к оплате добавляется
                  300 ₽ за доставку до пункта выдачи Ozon.
                </div>
              )}
            </div>

            {/* РџСЂРѕРјРѕРєРѕРґ */}
            <div className="mt-4">
              {promo ? (
                <div className="flex items-center justify-between gap-2 rounded-sm border border-signal/40 bg-signal/10 px-3 py-2.5 text-[0.82rem]">
                  <span>
                    РџСЂРѕРјРѕРєРѕРґ{" "}
                    <b className="font-semibold uppercase">{promo.code}</b> вЂ”
                    СЃРєРёРґРєР°{" "}
                    <b className="text-[var(--signal-text)]">{promo.percent}%</b>
                  </span>
                  <button
                    type="button"
                    onClick={removePromo}
                    aria-label="РЈР±СЂР°С‚СЊ РїСЂРѕРјРѕРєРѕРґ"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-signal"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoMsg("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    placeholder="РџСЂРѕРјРѕРєРѕРґ"
                    aria-label="РџСЂРѕРјРѕРєРѕРґ"
                    className={cn(inputCls, "uppercase")}
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    disabled={promoBusy || !promoInput.trim()}
                    className="shrink-0 rounded-sm border border-border px-4 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                  >
                    {promoBusy ? "вЂ¦" : "РџСЂРёРјРµРЅРёС‚СЊ"}
                  </button>
                </div>
              )}
              {promoMsg && (
                <p className="mt-1.5 text-[0.78rem] text-signal">{promoMsg}</p>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-signal" role="alert">
                {error}
              </p>
            )}

            {discount > 0 && (
              <div className="mt-5 space-y-1 text-sm">
                <div className="flex items-baseline justify-between text-muted-foreground">
                  <span>РЎСѓРјРјР°</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[var(--signal-text)]">
                  <span>РЎРєРёРґРєР° {promo?.percent}%</span>
                  <span>в€’{formatPrice(discount)}</span>
                </div>
              </div>
            )}
            <div className={cn("flex items-baseline justify-between", discount > 0 ? "mt-2" : "mt-5")}>
              <span className="text-sm">РС‚РѕРіРѕ</span>
              <span className="font-display text-xl font-extrabold">
                {formatPrice(payableWithDelivery)}
              </span>
            </div>
            {deliveryCharge > 0 && (
              <div className="mt-1.5 flex items-baseline justify-between text-sm text-muted-foreground">
                <span>Доставка Ozon (самовывоз)</span>
                <span>+ {formatPrice(deliveryCharge)}</span>
              </div>
            )}
            <YandexSplitBadge
              amount={payableWithDelivery}
              size="m"
              variant="detailed"
              color="primary"
              className="mb-4 mt-2"
            />
            <ConsentCheckbox
              id="rc-consent"
              checked={consent}
              onChange={setConsent}
              className="mb-4"
            />
            {payEnabled ? (
              <>
                <button
                  ref={payButtonRef}
                  onClick={() => submit(true)}
                   disabled={sending}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? "Оформляю заказ…" : customer ? "Оплатить на сайте" : "Войти и оплатить"}
                </button>
                <button
                  onClick={() => submit(false)}
                  disabled={sending}
                  className="mt-2.5 w-full rounded-sm border border-border py-3 text-sm font-semibold transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                >
                  РћС„РѕСЂРјРёС‚СЊ С‡РµСЂРµР· WhatsApp
                </button>
                <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
                  {paySandbox
                    ? "РћРїР»Р°С‚Р° СЂР°Р±РѕС‚Р°РµС‚ РІ С‚РµСЃС‚РѕРІРѕРј СЂРµР¶РёРјРµ: РЅР°СЃС‚РѕСЏС‰РёРµ РґРµРЅСЊРіРё РЅРµ СЃРїРёСЃС‹РІР°СЋС‚СЃСЏ."
                    : customer
                      ? "РљР°СЂС‚Р° Р±РµСЂС‘С‚СЃСЏ РёР· С‚РµРєСѓС‰РµРіРѕ РЇРЅРґРµРєСЃ ID РЅР° СЃС‚СЂР°РЅРёС†Рµ РЇРЅРґРµРєСЃ Pay вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ Р°РєРєР°СѓРЅС‚ Рё РїРѕСЃР»РµРґРЅРёРµ 4 С†РёС„СЂС‹. Р—Р°РєР°Р· СѓРІРёРґРёС‚ РјРµРЅРµРґР¶РµСЂ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РѕРїР»Р°С‚С‹."
                      : "РћРїР»Р°С‚Р° РґРѕСЃС‚СѓРїРЅР° РїРѕСЃР»Рµ РІС…РѕРґР° РёР»Рё СЂРµРіРёСЃС‚СЂР°С†РёРё. РњР°РіР°Р·РёРЅ РЅРµ С…СЂР°РЅРёС‚ РєР°СЂС‚С‹: РёС… РїРѕРєР°Р·С‹РІР°РµС‚ РЇРЅРґРµРєСЃ Pay РёР· С‚РµРєСѓС‰РµРіРѕ РЇРЅРґРµРєСЃ ID."}
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => submit(false)}
                  disabled={sending}
                  className="w-full rounded-sm bg-signal py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#ff6a1f] active:scale-[0.99] disabled:opacity-60"
                >
                  {sending ? "РћС„РѕСЂРјР»СЏРµРј Р·Р°РєР°Р·вЂ¦" : "РћС„РѕСЂРјРёС‚СЊ С‡РµСЂРµР· WhatsApp"}
                </button>
                <p className="mt-3 font-mono text-[0.66rem] leading-relaxed text-muted-foreground">
                  Р—Р°РєР°Р· СѓР№РґС‘С‚ РјРµРЅРµРґР¶РµСЂСѓ РІ WhatsApp: РѕРЅ РїРѕРґС‚РІРµСЂРґРёС‚ РЅР°Р»РёС‡РёРµ,
                  РЅР°Р·РѕРІС‘С‚ СЃС‚РѕРёРјРѕСЃС‚СЊ РґРѕСЃС‚Р°РІРєРё Рё РїСЂРёС€Р»С‘С‚ СЃРїРѕСЃРѕР±С‹ РѕРїР»Р°С‚С‹.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
