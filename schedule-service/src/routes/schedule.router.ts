import { Router } from "express";
import { validateRequest } from "../middlewares/validateRequest";
import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdParamSchema,
  applicableScheduleQuerySchema,
} from "../validations/schedule.validations";
import {
  createSchedule,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  getApplicableSchedule,
} from "../controllers/schedule.controller";

const router = Router();

// --- Ruta Pública/Interna para obtener horario aplicable ---
// Se define ANTES de router.use(authenticateAgency)
router.get(
  "/applicable",
  validateRequest(applicableScheduleQuerySchema),
  getApplicableSchedule
);

// POST /schedules -> Crear un nuevo horario
router.post("/", validateRequest(createScheduleSchema), createSchedule);

// GET /schedules -> Obtener todos los horarios de la agencia autenticada
router.get("/", getSchedules);

// PUT /schedules/:id -> Actualizar un horario específico
router.put("/:id", validateRequest(updateScheduleSchema), updateSchedule);

// DELETE /schedules/:id -> Eliminar un horario específico
router.delete("/:id", validateRequest(scheduleIdParamSchema), deleteSchedule);

export default router;
