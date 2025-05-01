import { RequestHandler, Response, NextFunction } from "express";
import prisma from "../db";
import logger from "../logger";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  InternalServerError,
} from "../errors/HttpErrors";
import { getDayOfWeekISO } from "../utils/timeUtils";

export const createSchedule: RequestHandler = async (req, res, next) => {
  const {
    name,
    daysOfWeek,
    entryTime,
    exitTime,
    gracePeriodMinutes,
    isDefault,
  } = req.body;
  const agencyId = req.headers["x-agency-id"] as string;

  if (!agencyId) {
    return next(new UnauthorizedError("Agencia no autenticada correctamente"));
  }

  try {
    if (isDefault === true) {
      await prisma.workSchedule.updateMany({
        where: { agencyId: agencyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newSchedule = await prisma.workSchedule.create({
      data: {
        agencyId,
        name,
        daysOfWeek,
        entryTime,
        exitTime,
        gracePeriodMinutes,
        isDefault,
      },
    });

    logger.info(
      { scheduleId: newSchedule.id, agencyId, name },
      "Horario creado exitosamente"
    );
    res.status(201).json(newSchedule);
  } catch (error: any) {
    if (
      error?.code === "P2002" &&
      error?.meta?.target?.includes("agencyId") &&
      error?.meta?.target?.includes("name")
    ) {
      next(
        new ConflictError(
          `Ya existe un horario con el nombre '${name}' para esta agencia.`
        )
      );
    } else if (
      error?.code === "P2002" &&
      error?.meta?.target?.includes("isDefault")
    ) {
      // Esto podría pasar si hay una condición de carrera al establecer isDefault, aunque updateMany debería prevenirlo.
      next(new ConflictError(`Error al establecer el horario por defecto.`));
    } else {
      logger.error({ err: error, agencyId }, "Error creando horario");
      next(error);
    }
  }
};

export const getSchedules: RequestHandler = async (req, res, next) => {
  const agencyId = req.headers["x-agency-id"] as string;
  if (!agencyId) {
    return next(new UnauthorizedError("Agencia no autenticada correctamente"));
  }

  try {
    const schedules = await prisma.workSchedule.findMany({
      where: { agencyId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    res.status(200).json(schedules);
  } catch (error) {
    logger.error({ err: error, agencyId }, "Error obteniendo horarios");
    next(error);
  }
};

export const updateSchedule: RequestHandler = async (req, res, next) => {
  const scheduleId = req.params.id;
  const agencyId = req.headers["x-agency-id"] as string;
  const updateData = req.body;

  if (!agencyId) {
    return next(new UnauthorizedError("Agencia no autenticada correctamente"));
  }
  if (Object.keys(updateData).length === 0) {
    return next(
      new BadRequestError("No se proporcionaron datos para actualizar.")
    );
  }

  try {
    // Asegurarse que el horario pertenezca a la agencia autenticada
    const existingSchedule = await prisma.workSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existingSchedule) {
      throw new NotFoundError(`Horario con ID ${scheduleId} no encontrado.`);
    }
    if (existingSchedule.agencyId !== agencyId) {
      throw new UnauthorizedError(
        "No tienes permiso para modificar este horario."
      );
    }

    // Manejo especial si se está cambiando isDefault
    if (updateData.isDefault === true && existingSchedule.isDefault === false) {
      await prisma.workSchedule.updateMany({
        where: { agencyId: agencyId, isDefault: true },
        data: { isDefault: false },
      });
    } else if (
      updateData.isDefault === false &&
      existingSchedule.isDefault === true
    ) {
      // Prevenir que se quite el último 'default'
      const defaultCount = await prisma.workSchedule.count({
        where: { agencyId: agencyId, isDefault: true, id: { not: scheduleId } },
      });
      if (defaultCount === 0) {
        throw new BadRequestError(
          "No puedes desactivar el único horario por defecto. Establece otro como defecto primero."
        );
      }
    }

    const updatedSchedule = await prisma.workSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });

    logger.info(
      { scheduleId: updatedSchedule.id, agencyId },
      "Horario actualizado exitosamente"
    );
    res.status(200).json(updatedSchedule);
  } catch (error: any) {
    if (
      error?.code === "P2002" &&
      error?.meta?.target?.includes("agencyId") &&
      error?.meta?.target?.includes("name")
    ) {
      next(
        new ConflictError(
          `Ya existe un horario con el nombre '${updateData.name}' para esta agencia.`
        )
      );
    } else {
      logger.error(
        { err: error, scheduleId, agencyId },
        "Error actualizando horario"
      );
      next(error);
    }
  }
};

export const deleteSchedule: RequestHandler = async (req, res, next) => {
  const scheduleId = req.params.id;
  const agencyId = req.headers["x-agency-id"] as string;

  if (!agencyId) {
    return next(new UnauthorizedError("Agencia no autenticada correctamente"));
  }

  try {
    const schedule = await prisma.workSchedule.findFirst({
      where: { id: scheduleId, agencyId: agencyId },
    });

    if (!schedule) {
      throw new NotFoundError(
        `Horario con ID ${scheduleId} no encontrado o no pertenece a tu agencia.`
      );
    }

    if (schedule.isDefault) {
      throw new BadRequestError(
        "No se puede eliminar el horario por defecto. Establece otro como defecto primero."
      );
    }

    // Consideración futura: Verificar si el horario está asignado a usuarios
    // if (schedule.assignedUserIds.length > 0) {
    //    throw new ConflictError("No se puede eliminar, horario asignado a usuarios.");
    // }

    await prisma.workSchedule.delete({
      where: { id: scheduleId },
    });

    logger.info({ scheduleId, agencyId }, "Horario eliminado.");
    res.status(204).send(); // No Content
  } catch (error) {
    logger.error(
      { err: error, scheduleId, agencyId },
      "Error eliminando horario"
    );
    next(error);
  }
};

export const getApplicableSchedule: RequestHandler = async (req, res, next) => {
  const { agencyId, userId, date } = req.query as any;
  const requestDate = new Date(date);
  const dayOfWeek = getDayOfWeekISO(requestDate);

  try {
    logger.info(
      { agencyId, userId, date: requestDate, dayOfWeek },
      "Buscando horario aplicable"
    );

    let applicableSchedule = null;

    // 1. Buscar horario específico para el usuario (si se proveyó userId)
    if (userId) {
      const userSpecificSchedule = await prisma.workSchedule.findFirst({
        where: {
          agencyId: agencyId,
          assignedUserIds: { has: userId }, // Busca si el userId está en el array
          daysOfWeek: { has: dayOfWeek }, // Verifica si el día aplica
        },
        // Podrías ordenar por fecha de creación/actualización si hubiera múltiples asignaciones (poco probable)
      });
      if (userSpecificSchedule) {
        logger.info(
          { scheduleId: userSpecificSchedule.id, userId },
          "Horario específico encontrado para el usuario"
        );
        applicableSchedule = userSpecificSchedule;
      }
    }

    // 2. Si no hay horario específico o no se proveyó userId, buscar el default
    if (!applicableSchedule) {
      const defaultSchedule = await prisma.workSchedule.findFirst({
        where: {
          agencyId: agencyId,
          isDefault: true,
          daysOfWeek: { has: dayOfWeek }, // Verifica si el día aplica
        },
      });
      if (defaultSchedule) {
        logger.info(
          { scheduleId: defaultSchedule.id, agencyId },
          "Horario por defecto encontrado"
        );
        applicableSchedule = defaultSchedule;
      }
    }

    // 3. Responder
    if (applicableSchedule) {
      res.status(200).json(applicableSchedule);
    } else {
      logger.warn(
        { agencyId, userId, date: requestDate, dayOfWeek },
        "No se encontró horario aplicable"
      );
      // Devolver 404 Not Found si no se encuentra ningún horario aplicable
      throw new NotFoundError(
        "No se encontró un horario de trabajo aplicable para la fecha y usuario especificados."
      );
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      return next(error); // Pasar el error 404 al manejador central
    }
    logger.error(
      { err: error, query: req.query },
      "Error buscando horario aplicable"
    );
    next(new InternalServerError("Error interno al buscar horario aplicable"));
  }
};
