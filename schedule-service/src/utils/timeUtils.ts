import { getDay } from "date-fns";

export function getDayOfWeekISO(date: Date): number {
  const day = getDay(date);
  return day === 0 ? 7 : day; // Ajusta Domingo de 0 a 7
}
