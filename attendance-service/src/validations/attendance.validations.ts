import { z } from "zod";

const attendanceTypeSchema = z.enum(["check-in", "check-out"], {
  errorMap: () => ({ message: "El tipo debe ser 'check-in' o 'check-out'" }),
});

// Para marcar asistencia MANUALMENTE (Agencia)
export const manualAttendanceSchema = z.object({
  body: z.object({
    userId: z.string().uuid("ID de usuario inválido"), // La agencia debe proveer el ID del usuario
    type: attendanceTypeSchema,
    notes: z.string().optional(),
  }),
});

// Para marcar asistencia con QR (Usuario)
export const qrAttendanceSchema = z.object({
  body: z.object({
    type: attendanceTypeSchema,
    // Podría incluirse data del QR si se valida algo específico
    // qrData: z.string().optional(),
    // Opcional: Podría añadirse 'location' si se captura
    // location: z.object({ lat: z.number(), lon: z.number() }).optional(),
  }),
});

// Para consultar historial
const isoDateSchema = z
  .string()
  .datetime({ message: "Formato de fecha inválido (ISO 8601 requerido)" });
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
