import { Router } from "express";
import { validateRequest } from "../middlewares/validateRequest";
import {
  activateInvitationSchema,
  createUserInvitationSchema,
  loginUserSchema,
  validateUserSchema,
} from "../validations/user.validations";
import {
  activateInvitedUser,
  loginUser,
  getMe,
  validateUserAgency,
  createInvitation,
} from "../controllers/user.controller";

const router = Router();

// POST /users/activate -> Activa una cuenta con código y establece contraseña
router.post(
  "/activate",
  validateRequest(activateInvitationSchema),
  activateInvitedUser
);

// POST /users/login -> Inicia sesión
router.post("/login", validateRequest(loginUserSchema), loginUser);

// POST /users/validate -> Endpoint interno para validación (usado por otros servicios)
router.post(
  "/validate",
  validateRequest(validateUserSchema),
  validateUserAgency
);

router.post(
  "/create-invitation",
  validateRequest(createUserInvitationSchema),
  createInvitation
);

// GET /users/me -> Obtiene datos del usuario autenticado
router.get("/me", getMe);

export default router;
