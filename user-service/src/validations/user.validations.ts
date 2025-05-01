import { z } from "zod";

// Esquema para Activar Usuario (POST /activate)
export const activateUserSchema = z.object({
  body: z.object({
    activationCode: z
      .string({ required_error: "Código de activación requerido" })
      .min(1, "Código de activación no puede estar vacío"),
    password: z
      .string({ required_error: "Contraseña es requerida" })
      .min(8, "Contraseña debe tener al menos 8 caracteres"),
    // Podrías añadir name/lastname aquí si quieres que se establezcan en la activación
    // name: z.string().min(1).optional(),
    // lastname: z.string().min(1).optional(),
  }),
});

// Esquema para Login de Usuario (POST /login)
export const loginUserSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email es requerido" })
      .email("Formato de email inválido"),
    password: z
      .string({ required_error: "Contraseña es requerida" })
      .min(1, "Contraseña no puede estar vacía"),
  }),
});

// Esquema para el endpoint de validación interna (si decides implementarlo)
export const validateUserSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    agencyId: z.string().uuid(),
  }),
});

// Esquema para Invitar Usuario (POST /invite)
export const activateInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Activation token is required"),
    name: z.string().min(3, "Name must be at least 3 characters long"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
  }),
});

export type ActivateInvitationInput = z.infer<
  typeof activateInvitationSchema
>["body"];

export const createUserInvitationSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    agencyId: z.string().uuid(),
  }),
});

export type CreateUserInvitationInput = z.infer<
  typeof createUserInvitationSchema
>["body"];
