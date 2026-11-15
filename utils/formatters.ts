import type { SupportedLang } from '../config/missionComms';

export function intlLocaleOf(lang: SupportedLang): string {
  return lang === 'en' ? 'en-US' : 'es-ES';
}

export function formatNumber(
  value: number,
  lang: SupportedLang,
  options?: Intl.NumberFormatOptions
): string {
  if (Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '∞';
  return new Intl.NumberFormat(intlLocaleOf(lang), options).format(value);
}

export function formatDecimal(
  value: number,
  decimals: number,
  lang: SupportedLang
): string {
  return formatNumber(value, lang, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parseUtcDate(dayKeyOrIso: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKeyOrIso)) {
    const [y, m, d] = dayKeyOrIso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const ms = Date.parse(dayKeyOrIso);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export function formatDateShort(dayKeyOrIso: string, lang: SupportedLang): string {
  const date = parseUtcDate(dayKeyOrIso);
  if (!date) return dayKeyOrIso;
  return new Intl.DateTimeFormat(intlLocaleOf(lang), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTimeShort(isoOrMs: string | number, lang: SupportedLang): string {
  const ms = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ms)) return String(isoOrMs);
  return new Intl.DateTimeFormat(intlLocaleOf(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatDurationSec(seconds: number, lang: SupportedLang): string {
  const s = Math.max(0, seconds);
  if (s < 10) {
    return `${formatDecimal(s, 1, lang)} s`;
  }
  if (s < 60) {
    return `${Math.round(s)} s`;
  }
  const mins = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return lang === 'en'
    ? `${mins}m ${String(rem).padStart(2, '0')}s`
    : `${mins} min ${String(rem).padStart(2, '0')} s`;
}

export function formatRelativeAgeHours(ageHours: number, lang: SupportedLang): string {
  const rounded = Math.round(ageHours);
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocaleOf(lang), { numeric: 'auto' });
    if (Math.abs(ageHours) < 1) {
      const mins = Math.max(1, Math.round(ageHours * 60));
      return rtf.format(-mins, 'minute');
    }
    return rtf.format(-rounded, 'hour');
  } catch {
    const formatted = formatDecimal(ageHours, 1, lang);
    return lang === 'en' ? `${formatted}h ago` : `hace ${formatted} h`;
  }
}
