import { z } from "zod";

// Esquema para Crear una Agencia (POST /)
export const createAgencySchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: "Nombre es requerido" })
      .min(1, "Nombre no puede estar vacío"),
    domain: z
      .string({ required_error: "Dominio/email es requerido" })
      .email("Formato de email inválido"),
    password: z
      .string({ required_error: "Contraseña es requerida" })
      .min(8, "Contraseña debe tener al menos 8 caracteres"),
    address: z.string().optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9\s-]+$/, "Formato de teléfono inválido")
      .optional(),
  }),
});

// Esquema para Login de Agencia (POST /login)
export const loginAgencySchema = z.object({
  body: z.object({
    // Usa 'domain' para login, ya que es el campo único en el modelo Agency
    domain: z
      .string({ required_error: "Dominio/email es requerido" })
      .email("Formato de email inválido"),
    password: z
      .string({ required_error: "Contraseña es requerida" })
      .min(1, "Contraseña no puede estar vacía"),
  }),
});

// Esquema para validar el parámetro ID (reutilizable)
export const agencyIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("El formato del ID debe ser un UUID válido"),
  }),
});

// Esquema para Actualizar una Agencia (PUT /:id)
export const updateAgencySchema = z.object({
  body: z
    .object({
      // Campos que se pueden actualizar (todos opcionales)
      name: z.string().min(1, "Nombre no puede estar vacío").optional(),
      // Nota: Cambiar 'domain' o 'password' es más complejo, lo omitimos por ahora para simplificar
      // Si necesitas cambiar contraseña, requeriría la contraseña actual.
      // Cambiar 'domain' afectaría el login, requiere cuidado.
      address: z.string().optional(),
      phone: z
        .string()
        .regex(/^\+?[0-9\s-]+$/, "Formato de teléfono inválido")
        .optional(),
      isActive: z.boolean().optional(),
    })
    .strict() // Evita que pasen campos no definidos en el esquema
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "El cuerpo de la solicitud no puede estar vacío",
    }),
});

export const inviteUserSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
    name: z.string().min(1, "Nombre no puede estar vacío"),
    lastname: z.string().optional(),
  }),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>["body"];
