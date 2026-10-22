import { en } from './en';
export type TranslationKey = keyof typeof en;
export const locale = 'en-GB';
export const facilityTimeZone = 'Europe/Rome';
export const t = (key: TranslationKey) => en[key];
export const time = (date: string) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: facilityTimeZone,
  }).format(new Date(date));
export const date = (value: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: facilityTimeZone,
  }).format(new Date(value));
export const fullDate = (value: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: facilityTimeZone,
  }).format(new Date(value));
export const localInput = (value: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: facilityTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(value))
    .replace(' ', 'T');
export function fromLocalInput(value: string) {
  // Resolve the facility UTC offset, including daylight saving time.
  const approx = new Date(`${value}:00Z`);
  const shown = localInput(approx.toISOString());
  return new Date(+approx - (+new Date(`${shown}:00Z`) - +approx)).toISOString();
}
