import { z } from "zod";

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido, usar HH:MM");

export const scheduleBodySchema = z.object({
  name: z.string().min(1, "Nombre del horario es requerido"),
  daysOfWeek: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Debe seleccionar al menos un día de la semana")
    .refine((items) => new Set(items).size === items.length, {
      message: "Los días de la semana no deben repetirse",
    }),
  entryTime: timeStringSchema,
  exitTime: timeStringSchema,
  gracePeriodMinutes: z.number().int().min(0).optional().default(10),
  isDefault: z.boolean().optional().default(false),
});

export const createScheduleSchema = z.object({
  body: scheduleBodySchema,
});

export const updateScheduleSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de horario inválido"),
  }),
  body: scheduleBodySchema
    .partial() // Hace todos los campos opcionales para la actualización
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "El cuerpo de la solicitud no puede estar vacío",
    }),
});

export const scheduleIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("ID de horario inválido"),
  }),
});

const dateSchema = z.preprocess((arg) => {
  if (typeof arg == "string") {
    try {
      // Intenta parsear como fecha completa ISO o solo YYYY-MM-DD
      const date = new Date(arg);
      // Validar si el parseo fue exitoso
      if (isNaN(date.getTime())) return arg;
      return date;
    } catch (e) {
      return arg;
    }
  }
  return arg;
}, z.date({ errorMap: () => ({ message: "Formato de fecha inválido" }) }));

export const applicableScheduleQuerySchema = z.object({
  query: z.object({
    agencyId: z.string().uuid("ID de agencia inválido"),
    userId: z.string().uuid("ID de usuario inválido").optional(), // El ID de usuario es opcional
    date: dateSchema, // Validar que sea una fecha válida
  }),
});
