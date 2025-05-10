import { z } from "zod";

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

export const getUsersQuerySchema = z.object({
  query: z.object({
    agencyId: z.string().uuid({ message: "Agency ID is required" }),
  }),
});

export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>["query"];
