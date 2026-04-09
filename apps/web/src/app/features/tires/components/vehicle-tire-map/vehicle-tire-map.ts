import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PoTagModule, PoTagType } from '@po-ui/ng-components';
import type { TireRecord } from '../../tires.types';
import {
  TIRE_HEALTH_COLOR,
  TIRE_HEALTH_LABEL,
  getTireHealthLevel,
  normalizePosition,
  type TireHealthLevel,
} from '../../tires.utils';

/** Slot de posição definido no layout do SVG */
type TireSlot = {
  code: string;
  label: string;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

const VEHICLE_CX = 150; // centro horizontal do SVG (viewBox 300)

/** Largura e altura de um slot de pneu */
const TW = 22;
const TH = 36;
/** Offset lateral do corpo do veículo até o pneu simples */
const SINGLE_OFFSET = 24;
/** Offsets para pneu duplo: externo e interno */
const DUAL_OUTER = 14;
const DUAL_INNER = 38;

function buildSingleAxleSlots(axle: number, y: number): TireSlot[] {
  const lCode = `E${axle}E`;
  const rCode = `E${axle}D`;
  return [
    {
      code: lCode,
      label: lCode,
      cx: VEHICLE_CX - SINGLE_OFFSET - TW / 2,
      cy: y,
      width: TW,
      height: TH,
    },
    {
      code: rCode,
      label: rCode,
      cx: VEHICLE_CX + SINGLE_OFFSET + TW / 2,
      cy: y,
      width: TW,
      height: TH,
    },
  ];
}

function buildDualAxleSlots(axle: number, y: number): TireSlot[] {
  const codes = [`E${axle}EE`, `E${axle}EI`, `E${axle}DI`, `E${axle}DE`];
  const xs = [
    VEHICLE_CX - DUAL_OUTER - TW / 2,
    VEHICLE_CX - DUAL_INNER - TW / 2,
    VEHICLE_CX + DUAL_INNER + TW / 2,
    VEHICLE_CX + DUAL_OUTER + TW / 2,
  ];
  return codes.map((code, i) => ({
    code,
    label: code,
    cx: xs[i],
    cy: y,
    width: TW,
    height: TH,
  }));
}

function buildSpareSlot(): TireSlot {
  return { code: 'ES', label: 'ES', cx: VEHICLE_CX, cy: 420, width: TW, height: TH };
}

/** Detecta se o veículo usa eixo traseiro duplo com base nas posições dos pneus */
function hasDualRear(tires: TireRecord[]): boolean {
  return tires.some((t) => {
    const p = normalizePosition(t.position);
    return p.includes('EI') || p.includes('EE') || p.includes('DI') || p.includes('DE');
  });
}

/** Detecta se há terceiro eixo */
function hasThirdAxle(tires: TireRecord[]): boolean {
  return tires.some((t) => normalizePosition(t.position).startsWith('E3'));
}

export type TireSlotEvent = { slot: TireSlot; tire: TireRecord | null };

@Component({
  selector: 'app-vehicle-tire-map',
  imports: [PoTagModule],
  templateUrl: './vehicle-tire-map.html',
  styleUrl: './vehicle-tire-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleTireMap {
  readonly tires = input.required<TireRecord[]>();
  readonly slotClick = output<TireSlotEvent>();

  protected readonly slots = computed<TireSlot[]>(() => {
    const t = this.tires();
    const dual = hasDualRear(t);
    const thirdAxle = hasThirdAxle(t);

    const slots: TireSlot[] = [
      ...buildSingleAxleSlots(1, 100),
      ...(dual ? buildDualAxleSlots(2, 280) : buildSingleAxleSlots(2, 280)),
    ];

    if (thirdAxle) {
      slots.push(...(dual ? buildDualAxleSlots(3, 340) : buildSingleAxleSlots(3, 340)));
    }

    slots.push(buildSpareSlot());
    return slots;
  });

  protected readonly tireByPosition = computed<Map<string, TireRecord>>(() => {
    const map = new Map<string, TireRecord>();
    for (const t of this.tires()) {
      const p = normalizePosition(t.position);
      if (p) map.set(p, t);
    }
    return map;
  });

  protected readonly svgHeight = computed<number>(() => {
    return hasThirdAxle(this.tires()) ? 470 : 460;
  });

  protected tireForSlot(slot: TireSlot): TireRecord | null {
    return this.tireByPosition().get(slot.code.toUpperCase()) ?? null;
  }

  protected slotFill(slot: TireSlot): string {
    const tire = this.tireForSlot(slot);
    if (!tire) return '#dde1e7';
    return TIRE_HEALTH_COLOR[getTireHealthLevel(tire)];
  }

  protected slotStroke(slot: TireSlot): string {
    const tire = this.tireForSlot(slot);
    if (!tire) return '#b0b8c3';
    const level = getTireHealthLevel(tire);
    return level === 'good'
      ? '#1ea96c'
      : level === 'warning'
        ? '#d4512b'
        : level === 'critical'
          ? '#c9302c'
          : '#868e96';
  }

  protected slotTooltip(slot: TireSlot): string {
    const tire = this.tireForSlot(slot);
    if (!tire) return `${slot.code} — vazio`;
    const level = getTireHealthLevel(tire);
    return `${slot.code}: ${tire.brand} ${tire.model} | Sulco: ${tire.currentGrooveDepth.toFixed(1)}mm | ${TIRE_HEALTH_LABEL[level]}`;
  }

  protected onSlotClick(slot: TireSlot): void {
    this.slotClick.emit({ slot, tire: this.tireForSlot(slot) });
  }

  protected readonly legendItems = computed<{ label: string; color: string; tagType: PoTagType }[]>(
    () => [
      { label: 'Bom estado', color: TIRE_HEALTH_COLOR.good, tagType: PoTagType.Success },
      { label: 'Desgaste moderado', color: TIRE_HEALTH_COLOR.warning, tagType: PoTagType.Warning },
      { label: 'Troca necessária', color: TIRE_HEALTH_COLOR.critical, tagType: PoTagType.Danger },
      { label: 'Vazio', color: '#dde1e7', tagType: PoTagType.Neutral },
    ],
  );

  protected healthLevel(tire: TireRecord): TireHealthLevel {
    return getTireHealthLevel(tire);
  }
}
