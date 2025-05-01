import { RequestHandler, Response, NextFunction } from "express";
import { AttendanceMethod } from "../../generated/prisma";
import { AttendanceService } from "../services/attendance.service";
import { BadRequestError, NotFoundError } from "../errors/HttpErrors";
import logger from "../logger";

const attendanceService = new AttendanceService();

// --- Marcar Asistencia Manual (Agencia) ---
export const markManualAttendance: RequestHandler = async (req, res, next) => {
  const { userId, type, notes } = req.body;
  const agencyId = req.headers["x-agency-id"] as string;

  if (!agencyId) return next(new BadRequestError("Agencia no autenticada"));

  try {
    logger.warn(
      { providedUserId: userId, agencyId },
      "VALIDACIÓN USUARIO-AGENCIA PENDIENTE (TODO)"
    );

    const result = await attendanceService.markAttendance({
      userId,
      agencyId,
      method: AttendanceMethod.MANUAL,
      type,
      notes,
    });
    res.status(type === "check-in" ? 201 : 200).json(result);
  } catch (error) {
    logger.error({ err: error, agencyId, userId }, "Error en marca manual");
    next(error);
  }
};

// --- Marcar Asistencia QR (Usuario) ---
export const markQrAttendance: RequestHandler = async (req, res, next) => {
  const { type } = req.body;

  const userId = req.headers["x-user-id"] as string;
  const agencyId = req.headers["x-agency-id"] as string;

  if (!userId || !agencyId) {
    return next(
      new BadRequestError(
        "Usuario no autenticado correctamente o falta agencyId"
      )
    );
  }

  try {
    const result = await attendanceService.markAttendance({
      userId,
      agencyId,
      method: AttendanceMethod.QR,
      type,
    });
    res.status(type === "check-in" ? 201 : 200).json(result);
  } catch (error) {
    logger.error({ err: error, userId, agencyId }, "Error en marca QR");
    next(error);
  }
};

// --- Obtener Historial (Agencia) ---
export const getAgencyHistory: RequestHandler = async (req, res, next) => {
  const { startDate, endDate, userId: filterUserId } = req.query as any;
  const agencyId = req.headers["x-agency-id"] as string;

  if (!agencyId) return next(new BadRequestError("Agencia no autenticada"));

  try {
    const history = await attendanceService.getHistory({
      agencyId,
      userId: filterUserId,
      startDate,
      endDate,
    });
    res.status(200).json(history);
  } catch (error) {
    logger.error(
      { err: error, agencyId, query: req.query },
      "Error obteniendo historial (agencia)"
    );
    next(error);
  }
};

// --- Obtener Historial (Usuario) ---
export const getUserHistory: RequestHandler = async (req, res, next) => {
  const { startDate, endDate } = req.query as any;
  const userId = req.headers["x-user-id"] as string;

  if (!userId) return next(new BadRequestError("Usuario no autenticado"));

  try {
    const history = await attendanceService.getHistory({
      userId,
      startDate,
      endDate,
    });
    res.status(200).json(history);
  } catch (error) {
    logger.error(
      { err: error, userId, query: req.query },
      "Error obteniendo historial (usuario)"
    );
    next(error);
  }
};

// --- Obtener Estado Hoy (Usuario) ---
export const getUserTodayStatus: RequestHandler = async (req, res, next) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return next(new BadRequestError("Usuario no autenticado"));

  try {
    const status = await attendanceService.getTodayStatusForUser(userId);
    if (!status) {
      res
        .status(200)
        .json({ message: "No hay registro de asistencia para hoy." });
      return;
    }
    res.status(200).json(status);
  } catch (error) {
    logger.error(
      { err: error, userId },
      "Error obteniendo estado hoy (usuario)"
    );
    next(error);
  }
};
