import { z } from "zod";

const attendanceTypeSchema = z.enum(["check-in", "check-out"], {
  errorMap: () => ({ message: "El tipo debe ser 'check-in' o 'check-out'" }),
});

// Para marcar asistencia MANUALMENTE (Agencia)
export const manualAttendanceSchema = z.object({
  body: z.object({
    userId: z.string().uuid("ID de usuario inválido"),
    type: attendanceTypeSchema,
    notes: z.string().optional(),
  }),
});

// Preprocesa strings de fecha a objetos Date
const dateSchema = z.preprocess((arg) => {
  if (typeof arg == "string") {
    try {
      return new Date(arg);
    } catch (e) {
      return arg;
    }
  }
  return arg;
}, z.date({ errorMap: () => ({ message: "Formato de fecha inválido" }) }));

export const attendanceHistoryQuerySchema = z.object({
  query: z
    .object({
      startDate: dateSchema,
      endDate: dateSchema,
      userId: z.string().uuid("ID de usuario inválido").optional(),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: "La fecha final debe ser igual o posterior a la fecha inicial",
      path: ["endDate"],
    }),
});

export const generateQrLinkSchema = z.object({
  query: z.object({
    type: attendanceTypeSchema,
  }),
});
