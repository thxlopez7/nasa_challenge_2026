import type { IndicatorMeta, TrackedIndicatorKey } from '../types/telemetry';

export interface IndicatorScheduleSpec {
  key: TrackedIndicatorKey;
  /** Intervalo máximo recomendado antes de marcar la medición como desactualizada (horas). */
  maxAgeHours: number;
  /** Etiqueta legible en español e inglés. */
  label: { es: string; en: string };
}

export const MEASUREMENT_SCHEDULE: ReadonlyArray<IndicatorScheduleSpec> = [
  {
    key: 'bp',
    maxAgeHours: 24,
    label: { es: 'Presión arterial', en: 'Blood pressure' },
  },
  {
    key: 'glucose',
    maxAgeHours: 24,
    label: { es: 'Glucosa capilar', en: 'Capillary glucose' },
  },
  {
    key: 'temp',
    maxAgeHours: 12,
    label: { es: 'Temperatura corporal', en: 'Body temperature' },
  },
  {
    key: 'behavioral',
    maxAgeHours: 24,
    label: { es: 'Check-in conductual y PHQ-2', en: 'Behavioral & PHQ-2 check-in' },
  },
  {
    key: 'bloodPanel',
    maxAgeHours: 72,
    label: { es: 'Cartucho renal/inmune', en: 'Renal/immune blood cartridge' },
  },
];

export interface IndicatorFreshness {
  key: TrackedIndicatorKey;
  label: { es: string; en: string };
  maxAgeHours: number;
  lastMeasuredAt?: string;
  source?: 'sensor' | 'manual';
  ageHours: number | null;
  isStale: boolean;
  neverMeasured: boolean;
}

/**
 * Función pura y determinística para evaluar recordatorios y mediciones vencidas.
 * Recibe `nowMs` explícitamente desde el llamador (nunca llama a `Date.now()`).
 */
export function evaluateMeasurementSchedule(
  indicatorMeta: Partial<Record<TrackedIndicatorKey, IndicatorMeta>> | undefined,
  nowMs: number,
  behavioralUpdatedAt?: string
): IndicatorFreshness[] {
  return MEASUREMENT_SCHEDULE.map((spec) => {
    const meta = indicatorMeta?.[spec.key];
    const ts = meta?.measuredAt ?? (spec.key === 'behavioral' ? behavioralUpdatedAt : undefined);

    if (!ts) {
      return {
        key: spec.key,
        label: spec.label,
        maxAgeHours: spec.maxAgeHours,
        ageHours: null,
        isStale: true,
        neverMeasured: true,
      };
    }

    const parsedMs = Date.parse(ts);
    if (!Number.isFinite(parsedMs)) {
      return {
        key: spec.key,
        label: spec.label,
        maxAgeHours: spec.maxAgeHours,
        ageHours: null,
        isStale: true,
        neverMeasured: true,
      };
    }

    const ageHours = Math.max(0, (nowMs - parsedMs) / 3_600_000);
    return {
      key: spec.key,
      label: spec.label,
      maxAgeHours: spec.maxAgeHours,
      lastMeasuredAt: ts,
      source: meta?.source,
      ageHours: Number(ageHours.toFixed(1)),
      isStale: ageHours > spec.maxAgeHours,
      neverMeasured: false,
    };
  });
}
