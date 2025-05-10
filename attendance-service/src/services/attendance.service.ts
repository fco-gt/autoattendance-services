import axios from "axios";
import prisma from "../db";
import {
  AttendanceMethod,
  AttendanceStatus,
  AttendanceRecord,
} from "../../generated/prisma";
import logger from "../logger";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../errors/HttpErrors";
import {
  calculateCheckInStatus,
  getDateOnly,
  getDayOfWeekISO,
  isCheckOutAllowed,
  parseTimeStringToDate,
  formatForLog,
} from "../utils/timeUtils";
import { addDays } from "date-fns";

const GATEWAY_URL = process.env.GATEWAY_URL;

// --- Interfaz Placeholder para datos de otros servicios ---
// Esto simula lo que obtendríamos al llamar a otros servicios
interface ExternalData {
  schedule?: {
    entryTime: string; // "HH:MM"
    exitTime: string; // "HH:MM"
    gracePeriodMinutes: number;
    daysOfWeek: number[];
  } | null;
}

export class AttendanceService {
  // --- MÉTODO CENTRAL: Marcar Asistencia ---
  async markAttendance(params: {
    userId: string;
    agencyId: string;
    method: AttendanceMethod;
    type: "check-in" | "check-out";
    currentTime?: Date; // Para testing o registros manuales en otra fecha
    notes?: string;
  }): Promise<AttendanceRecord> {
    const { userId, agencyId, method, type, notes } = params;
    const now = params.currentTime || new Date(); // Hora actual o la provista
    const todayDate = getDateOnly(now); // Fecha del registro (medianoche UTC)

    logger.info(
      { userId, agencyId, type, method, time: formatForLog(now) },
      "Intentando marcar asistencia"
    );

    // --- PASO 1: Validar Usuario ---

    try {
      const validationUrl = `${GATEWAY_URL}/v1/api/users/validate`;
      logger.info({ userId, agencyId }, "Llamando a User Service");

      const response = await axios.post<{ isValid: boolean }>(validationUrl, {
        userId,
        agencyId,
      });

      if (!response.data || !response.data.isValid) {
        logger.warn(
          { userId, agencyId },
          "Usuario no válido o no pertenece a la agencia"
        );
        throw new BadRequestError(
          `Usuario ${userId} inválido o no pertenece a la agencia ${agencyId}`
        );
      }

      logger.info({ userId, agencyId }, "Usuario válido");
    } catch (error: any) {
      logger.error(
        { err: error, userId, agencyId },
        "Error durante la validación del usuario"
      );
      if (axios.isAxiosError(error)) {
        throw new InternalServerError(
          `Error comunicándose con User Service: ${error.message}`
        );
      }
      throw error;
    }

    // --- PASO 2: Obtener Horario Aplicable ---
    let scheduleData: ExternalData["schedule"] = null;

    try {
      const scheduleUrl = `${GATEWAY_URL}/v1/api/schedules/applicable`;
      const dateString = formatForLog(todayDate);

      logger.info(
        { url: scheduleUrl, agencyId, userId, date: dateString },
        "Llamando a Schedule Service"
      );

      const response = await axios.get<ExternalData["schedule"]>(scheduleUrl, {
        params: {
          agencyId,
          userId,
          date: todayDate.toISOString().split("T")[0],
        },
      });

      scheduleData = response.data;

      logger.info({ schedule: scheduleData }, "Horario aplicable encontrado");
    } catch (error: any) {
      logger.error(
        { err: error, agencyId, userId, date: formatForLog(todayDate) },
        "Error obteniendo horario aplicable"
      );
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new BadRequestError(
            "No hay un horario de trabajo aplicable para hoy."
          );
        }

        throw new InternalServerError(
          `Error comunicándose con Schedule Service: ${error.message}`
        );
      }
      throw error;
    }

    if (!scheduleData) {
      logger.warn(
        { userId, agencyId, date: formatForLog(todayDate) },
        "No se encontró horario aplicable."
      );
      throw new BadRequestError(
        "No hay un horario de trabajo aplicable para hoy."
      );
    }

    // Convertir horas HH:MM a objetos Date para comparar
    const scheduleEntryTime = parseTimeStringToDate(
      scheduleData.entryTime,
      now
    );
    const scheduleExitTime = parseTimeStringToDate(scheduleData.exitTime, now);
    if (!scheduleEntryTime || !scheduleExitTime) {
      logger.error(
        { scheduleData },
        "Formato de hora inválido en horario obtenido"
      );
      throw new InternalServerError(
        "Error de configuración en el horario de trabajo."
      );
    }

    // --- PASO 3: Lógica de Check-in / Check-out ---
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date: todayDate } },
    });

    if (type === "check-in") {
      if (existingRecord) {
        throw new ConflictError("Ya se registró una entrada para hoy.");
      }

      const status = calculateCheckInStatus(
        now,
        scheduleEntryTime,
        scheduleData.gracePeriodMinutes
      );

      const newRecord = await prisma.attendanceRecord.create({
        data: {
          userId,
          agencyId,
          checkInTime: now,
          date: todayDate,
          status, // ON_TIME o LATE
          methodIn: method,
          notes,
          scheduleEntryTime: scheduleData.entryTime, // Guardamos "HH:MM"
          scheduleExitTime: scheduleData.exitTime, // Guardamos "HH:MM"
        },
      });
      logger.info(
        { recordId: newRecord.id, userId, status },
        "Check-in registrado."
      );
      return newRecord;
    } else {
      // type === 'check-out'
      if (!existingRecord) {
        throw new BadRequestError(
          "Debe registrar la entrada antes de la salida."
        );
      }
      if (existingRecord.checkOutTime) {
        throw new ConflictError("Ya se registró una salida para hoy.");
      }

      // Opcional: Validar si ya es hora de salida
      // const allowedToCheckout = isCheckOutAllowed(now, scheduleExitTime);
      // if (!allowedToCheckout) {
      //     throw new BadRequestError(`Aún no es hora de marcar salida (después de ${scheduleData.exitTime}).`);
      // }

      const updatedRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          checkOutTime: now,
          methodOut: method,
          notes: notes || existingRecord.notes, // Actualizar notas si vienen
        },
      });
      logger.info(
        { recordId: updatedRecord.id, userId },
        "Check-out registrado."
      );
      return updatedRecord;
    }
  }

  // --- Obtener Historial ---
  async getHistory(params: {
    agencyId?: string; // Si consulta la agencia
    userId?: string; // Si consulta el usuario o la agencia filtra por uno
    startDate: Date;
    endDate: Date;
  }) {
    const { agencyId, userId, startDate, endDate } = params;

    // Asegurar que las fechas cubran días completos en UTC
    const start = getDateOnly(startDate);
    const end = getDateOnly(addDays(endDate, 1)); // Hasta el inicio del día *siguiente*

    const whereClause: any = {
      date: {
        gte: start,
        lt: end, // Menor que el inicio del día siguiente
      },
    };

    if (userId) {
      whereClause.userId = userId;
      // Si también viene agencyId, podemos verificar que el userId pertenezca (redundante si el token ya lo valida)
      if (agencyId) {
        whereClause.agencyId = agencyId; // Filtra también por agencia
      }
    } else if (agencyId) {
      // Si solo viene agencyId, trae todos los de la agencia
      whereClause.agencyId = agencyId;
    } else {
      throw new BadRequestError(
        "Se requiere agencyId o userId para buscar historial."
      );
    }

    logger.info({ filters: whereClause }, "Buscando historial de asistencia");

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
    });

    // TODO: Enriquecer con datos del usuario (nombre, etc.) llamando a User Service
    // Por ahora, solo devolvemos los IDs
    return records;
  }

  // --- Obtener Estado de Hoy (simplificado) ---
  async getTodayStatusForUser(userId: string) {
    const today = getDateOnly(new Date());
    const record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date: today } },
      // Seleccionar campos relevantes para el usuario
      select: {
        id: true,
        userId: true,
        agencyId: true,
        date: true,
        checkInTime: true,
        checkOutTime: true,
        status: true,
        methodIn: true,
        methodOut: true,
        notes: true,
        scheduleEntryTime: true,
        scheduleExitTime: true,
      },
    });
    return record;
  }
}
