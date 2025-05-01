import {
  parse,
  set,
  isBefore,
  isAfter,
  addMinutes,
  getDay,
  startOfDay,
  formatISO,
  isValid,
} from "date-fns";
import { AttendanceStatus } from '../../generated/prisma';
// Parsea "HH:MM" a un objeto Date en el contexto de 'now'
export function parseTimeStringToDate(
  timeString: string,
  now: Date
): Date | null {
  const match = timeString.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const date = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });
  return isValid(date) ? date : null;
}

// Calcula el estado de check-in comparando con la hora de entrada y gracia
export function calculateCheckInStatus(
  checkInTime: Date,
  scheduleEntryTime: Date | null, // Ahora recibe Date
  graceMinutes: number
): AttendanceStatus | null {
  // Puede ser null si no hay hora de entrada
  if (!scheduleEntryTime) return null; // No se puede calcular sin hora de entrada

  const graceTime = addMinutes(scheduleEntryTime, graceMinutes);

  // Si checkInTime es ANTES o IGUAL a la hora + gracia -> ON_TIME
  if (
    isBefore(checkInTime, graceTime) ||
    checkInTime.getTime() === graceTime.getTime()
  ) {
    return AttendanceStatus.ON_TIME;
  } else {
    return AttendanceStatus.LATE;
  }
}

// Verifica si ya es hora de marcar salida
export function isCheckOutAllowed(
  now: Date,
  scheduleExitTime: Date | null // Ahora recibe Date
): boolean {
  if (!scheduleExitTime) return false; // No permitido si no hay hora de salida definida

  // Permite marcar salida si la hora actual es DESPUÉS o IGUAL a la hora de salida
  return (
    isAfter(now, scheduleExitTime) ||
    now.getTime() === scheduleExitTime.getTime()
  );
}

// Obtiene el día de la semana (Lunes=1, ..., Domingo=7)
export function getDayOfWeekISO(date: Date): number {
  const day = getDay(date);
  return day === 0 ? 7 : day; // Ajusta Domingo de 0 a 7
}

// Obtiene solo la parte de la fecha (a medianoche GMT/UTC)
export function getDateOnly(date: Date): Date {
  // Crea una nueva fecha para evitar mutar la original
  const newDate = new Date(date);
  newDate.setUTCHours(0, 0, 0, 0); // Pone la hora a 00:00:00.000 UTC
  return newDate;
}

// Formato estándar para logs
export function formatForLog(date: Date | null | undefined): string | null {
  return date ? formatISO(date) : null;
}
