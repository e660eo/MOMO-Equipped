"use client";

import { useMemo, useState } from "react";
import { CarFront, CheckCircle2, CircleAlert, Ruler, Wrench } from "lucide-react";
import {
  compatibleVehicleSlots,
  detectSpeakerMount,
  slotMatchesMount,
  slotSizeLabel,
  VEHICLE_FITMENTS,
  VEHICLE_MAKES,
  type FitmentMethod,
  type VehicleMake,
} from "@/lib/vehicle-fitment";
import { METRIKA_GOALS, reachMetrikaGoal } from "@/lib/metrika";

const methodCopy: Record<FitmentMethod, { title: string; short: string }> = {
  direct: { title: "Подойдёт в штатное место", short: "Штатно" },
  adapter: { title: "Подойдёт через проставку", short: "С проставкой" },
  modification: { title: "Можно установить с доработкой", short: "С доработкой" },
};

export function VehicleFitment({
  productSlug,
  productTitle,
  diameterMm,
}: {
  productSlug: string;
  productTitle: string;
  diameterMm?: number;
}) {
  const mount = useMemo(
    () => detectSpeakerMount(productTitle, diameterMm),
    [productTitle, diameterMm],
  );
  const [make, setMake] = useState<VehicleMake>("LADA");
  const [vehicleId, setVehicleId] = useState("");

  const vehicles = VEHICLE_FITMENTS.filter((vehicle) => vehicle.make === make);
  const selectedVehicle = VEHICLE_FITMENTS.find((vehicle) => vehicle.id === vehicleId);
  const selectedMatches = selectedVehicle?.slots.filter((slot) => slotMatchesMount(slot, mount)) ?? [];
  const compatible = compatibleVehicleSlots(mount);
  const compatibleVehicleCount = new Set(compatible.map(({ vehicle }) => vehicle.id)).size;

  const selectVehicle = (id: string) => {
    setVehicleId(id);
    if (!id) return;
    const vehicle = VEHICLE_FITMENTS.find((item) => item.id === id);
    const result = vehicle?.slots.some((slot) => slotMatchesMount(slot, mount)) ?? false;
    reachMetrikaGoal(METRIKA_GOALS.vehicleFitmentCheck, {
      product: productSlug,
      vehicle: id,
      compatible: result,
    });
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="vehicle-fitment-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal text-white" aria-hidden="true">
          <CarFront size={21} />
        </span>
        <div className="min-w-0">
          <h2 id="vehicle-fitment-title" className="font-display text-base font-semibold sm:text-lg">
            Подойдёт ли к моей машине?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Выберите автомобиль — покажем место и способ установки.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-border py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-medium">
          <Ruler size={16} className="text-signal" aria-hidden="true" />
          Размер товара: {mount.label}
        </span>
        {compatibleVehicleCount > 0 && mount.kind !== "horn" && (
          <span className="rounded-full border border-signal/25 bg-signal/5 px-2.5 py-1 text-xs font-semibold text-signal">
            {compatibleVehicleCount} {compatibleVehicleCount === 1 ? "автомобиль" : compatibleVehicleCount < 5 ? "автомобиля" : "автомобилей"} в базе
          </span>
        )}
      </div>

      {mount.kind === "horn" || mount.kind === "unknown" ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-border bg-background p-4">
          <Wrench size={20} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {mount.kind === "horn" ? "Для рупора нужно отдельное место установки" : "Не удалось определить типоразмер"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {mount.kind === "horn"
                ? "Рупор ставят в стойку, уголок зеркала или специальный подиум. Совместимость со штатным местом по одному диаметру определить нельзя."
                : "Уточните монтажный диаметр и глубину у поддержки — мы подберём вариант под ваш автомобиль."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Марка
              <select
                value={make}
                onChange={(event) => {
                  setMake(event.target.value as VehicleMake);
                  setVehicleId("");
                }}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/20"
              >
                {VEHICLE_MAKES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Модель и поколение
              <select
                value={vehicleId}
                onChange={(event) => selectVehicle(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/20"
              >
                <option value="">Выберите модель</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.model} · {vehicle.years}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedVehicle && (
            <div className="mt-4" aria-live="polite">
              {selectedMatches.length > 0 ? (
                <div className="space-y-2">
                  {selectedMatches.map((slot) => (
                    <div key={`${slot.location}-${slot.kind}-${slot.diameterMm ?? "oval"}`} className="rounded-xl border border-signal/30 bg-signal/5 p-4">
                      <div className="flex items-start gap-3">
                        {slot.method === "direct" ? (
                          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                        ) : (
                          <Wrench size={20} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                        )}
                        <div>
                          <p className="text-sm font-semibold">{methodCopy[slot.method].title}</p>
                          <p className="mt-1 text-sm">{slot.location} · {slotSizeLabel(slot)}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{slot.note}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start gap-3">
                    <CircleAlert size={20} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">Этот размер не совпадает с типовыми местами</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Для {selectedVehicle.make} {selectedVehicle.model} в базе: {Array.from(new Set(selectedVehicle.slots.map(slotSizeLabel))).join(", ")}.
                        Установить этот товар можно только после индивидуального замера и изготовления подиума.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {compatible.length > 0 && (
            <details className="mt-4 rounded-xl border border-border bg-background">
              <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold marker:text-signal">
                На какие машины подходит {mount.label}
              </summary>
              <div className="border-t border-border px-4 py-2">
                {compatible.map(({ vehicle, slot }) => (
                  <div key={`${vehicle.id}-${slot.location}-${slot.kind}-${slot.diameterMm ?? "oval"}`} className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                    <div>
                      <p className="text-sm font-semibold">{vehicle.make} {vehicle.model}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{vehicle.years} · {slot.location}</p>
                    </div>
                    <span className="text-xs font-semibold text-signal sm:text-right">{methodCopy[slot.method].short}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
        База показывает типовой размер. Перед установкой проверьте глубину корзины, крепёж, разъём и комплектацию автомобиля.
      </p>
    </section>
  );
}

