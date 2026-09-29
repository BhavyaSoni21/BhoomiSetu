// Turn a backend enum (PENDING, COURT_ORDER) into a human label.
// SNAKE_CASE / ALL_CAPS -> Title Case.
export function humanizeEnum(value?: string | null): string {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Translated status label with a humanized fallback, so a missing i18n key
// renders "In Progress", never the raw "IN_PROGRESS".
// `t` is the useTranslation() function; `prefix` is the i18n namespace.
export function statusLabel(
  t: (key: string, fallback?: string) => string,
  value?: string | null,
  prefix = 'cases.status',
): string {
  if (!value) return '-';
  return t(`${prefix}.${value}`, humanizeEnum(value));
}
