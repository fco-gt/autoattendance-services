import { Router } from "express";
import { validateRequest } from "../middlewares/validateRequest";
import {
  manualAttendanceSchema,
  qrAttendanceSchema,
  attendanceHistoryQuerySchema,
} from "../validations/attendance.validations";
import {
  markManualAttendance,
  markQrAttendance,
  getAgencyHistory,
  getUserHistory,
  getUserTodayStatus,
} from "../controllers/attendance.controller";

const router = Router();

// --- Rutas para Agencias ---
router.post(
  "/manual",
  validateRequest(manualAttendanceSchema),
  markManualAttendance
);

router.get(
  "/history/agency",
  validateRequest(attendanceHistoryQuerySchema),
  getAgencyHistory
);

// --- Rutas para Usuarios ---
router.post("/qr", validateRequest(qrAttendanceSchema), markQrAttendance);

router.get("/today", getUserTodayStatus);

router.get(
  "/history/user",
  validateRequest(attendanceHistoryQuerySchema),
  getUserHistory
);

export default router;
