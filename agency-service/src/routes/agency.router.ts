// packages/agency-service/src/routes/agency.router.ts
import { Router } from "express";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createAgencySchema,
  inviteUserSchema,
  loginAgencySchema,
  updateAgencySchema,
} from "../validations/agency.validations";
import {
  createAgency,
  loginAgency,
  getMyAgency,
  updateMyAgency,
  inviteUser,
} from "../controllers/agency.controller";

const router = Router();

// POST /agencies -> Crear nueva agencia
router.post("/register", validateRequest(createAgencySchema), createAgency);

// POST /agencies/login -> Iniciar sesión de agencia
router.post("/login", validateRequest(loginAgencySchema), loginAgency);

// GET /agencies/me -> Obtener datos de la agencia autenticada
router.get("/me", getMyAgency);

// PUT /agencies/me -> Actualizar datos de la agencia autenticada
// Usamos /me para la ruta ya que la ID viene del token
router.put(
  "/me",
  validateRequest(updateAgencySchema),
  updateMyAgency
);

router.post(
  "/invite-user",
  validateRequest(inviteUserSchema),
  inviteUser
);

export default router;
