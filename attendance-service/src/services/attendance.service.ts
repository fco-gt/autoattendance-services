import axios from "axios";
import prisma from "../db";
import { AttendanceMethod, AttendanceRecord } from "../../generated/prisma";
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
  parseTimeStringToDate,
  formatForLog,
} from "../utils/timeUtils";
import { addDays } from "date-fns";
import jwt from "jsonwebtoken";

const GATEWAY_URL = process.env.GATEWAY_URL;
const PUBLIC_GATEWAY_URL = process.env.PUBLIC_GATEWAY_URL;

interface ExternalData {
  schedule?: {
    entryTime: string;
    exitTime: string;
    gracePeriodMinutes: number;
    daysOfWeek: number[];
  } | null;
}

interface QrPayload {
  agencyId: string;
  type: "check-in" | "check-out";
  iat: number;
  exp: number;
}

export class AttendanceService {
  async markAttendance(params: {
    userId: string;
    agencyId: string;
    method: AttendanceMethod;
    type: "check-in" | "check-out";
    currentTime?: Date;
    notes?: string;
  }): Promise<AttendanceRecord> {
    const { userId, agencyId, method, type, notes } = params;
    const now = params.currentTime || new Date();
    const todayDate = getDateOnly(now);

    logger.info(
      { userId, agencyId, type, method, time: formatForLog(now) },
      "Intentando marcar asistencia"
    );

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
          status,
          methodIn: method,
          notes,
          scheduleEntryTime: scheduleData.entryTime,
          scheduleExitTime: scheduleData.exitTime,
        },
      });

      logger.info(
        { recordId: newRecord.id, userId, status },
        "Check-in registrado."
      );

      return newRecord;
    } else {
      if (!existingRecord) {
        throw new BadRequestError(
          "Debe registrar la entrada antes de la salida."
        );
      }
      if (existingRecord.checkOutTime) {
        throw new ConflictError("Ya se registró una salida para hoy.");
      }

      const updatedRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          checkOutTime: now,
          methodOut: method,
          notes: notes || existingRecord.notes,
        },
      });
      logger.info(
        { recordId: updatedRecord.id, userId },
        "Check-out registrado."
      );
      return updatedRecord;
    }
  }

  async getHistory(params: {
    agencyId?: string;
    userId?: string;
    startDate: Date;
    endDate: Date;
  }) {
    const { agencyId, userId, startDate, endDate } = params;
    const start = getDateOnly(startDate);
    const end = getDateOnly(addDays(endDate, 1));

    const whereClause: any = {
      date: {
        gte: start,
        lt: end,
      },
    };

    if (userId) {
      whereClause.userId = userId;
      if (agencyId) {
        whereClause.agencyId = agencyId;
      }
    } else if (agencyId) {
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

    return records;
  }

  async getTodayStatusForUser(userId: string) {
    const today = getDateOnly(new Date());
    const record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date: today } },
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

  async generateQRLink(agencyId: string, type: "check-in" | "check-out") {
    const secret = process.env.AGENCY_ATTENDANCE_SECRET;

    if (!secret) {
      throw new Error("No se ha configurado el secreto de la agencia");
    }

    const token = jwt.sign(
      {
        agencyId,
        type,
      },
      secret,
      {
        expiresIn: "1h",
        algorithm: "HS256",
      }
    );

    const url = `${PUBLIC_GATEWAY_URL}/v1/api/attendance/qr?token=${token}&type=${type}`;

    return url;
  }

  async verifyQrToken(token: string) {
    const secret = process.env.AGENCY_ATTENDANCE_SECRET;

    if (!secret) {
      throw new Error("No se ha configurado el secreto de la agencia");
    }

    let payload: QrPayload;

    try {
      payload = jwt.verify(token, secret) as QrPayload;

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new BadRequestError("El QR ha expirado");
      }

      return payload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new BadRequestError("El QR ha expirado");
      }
      throw new BadRequestError("Token de QR inválido");
    }
  }

  async markQrAttendance(
    userId: string,
    token: string,
    type: "check-in" | "check-out"
  ) {
    const { agencyId, type: qrType } = await this.verifyQrToken(token);

    if (qrType !== type) {
      throw new BadRequestError(
        "Tipo de QR no coincide con el tipo de asistencia"
      );
    }

    const record = await this.markAttendance({
      userId,
      agencyId,
      method: AttendanceMethod.QR,
      type,
    });

    logger.info(
      { recordId: record.id, userId, agencyId },
      "Asistencia QR registrada"
    );

    return record;
  }
}
