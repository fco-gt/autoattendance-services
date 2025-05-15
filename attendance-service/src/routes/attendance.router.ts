import { Router } from "express";
import { validateRequest } from "../middlewares/validateRequest";
import {
  manualAttendanceSchema,
  attendanceHistoryQuerySchema,
  generateQrLinkSchema,
} from "../validations/attendance.validations";
import {
  markManualAttendance,
  getAgencyHistory,
  getUserHistory,
  getUserTodayStatus,
  generateQrLink,
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

router.post("/qr", validateRequest(generateQrLinkSchema), generateQrLink);

// --- Rutas para Usuarios ---
router.get("/today", getUserTodayStatus);

router.get(
  "/history/user",
  validateRequest(attendanceHistoryQuerySchema),
  getUserHistory
);

export default router;
