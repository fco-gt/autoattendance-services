import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import proxy from "express-http-proxy";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import logger from "./logger";
import "dotenv/config";

const PORT = process.env.PORT;
const AGENCY_SERVICE_URL = process.env.AGENCY_SERVICE_URL;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const SCHEDULE_SERVICE_URL = process.env.SCHEDULE_SERVICE_URL;
const ATTENDANCE_SERVICE_URL = process.env.ATTENDANCE_SERVICE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;
const FRONTEND_APP_URL = process.env.FRONTEND_APP_URL;
const USER_SECRET = process.env.USER_JWT_SECRET;
const AGENCY_SECRET = process.env.AGENCY_JWT_SECRET;

if (
  !AGENCY_SERVICE_URL ||
  !USER_SERVICE_URL ||
  !SCHEDULE_SERVICE_URL ||
  !ATTENDANCE_SERVICE_URL ||
  !FRONTEND_URL ||
  !FRONTEND_APP_URL ||
  !USER_SECRET ||
  !AGENCY_SECRET
) {
  logger.error(
    "Faltan variables de entorno para todos los servicios. Gateway no iniciará."
  );
  process.exit(1);
}

logger.info(`
  API Gateway configurado con:
  - PORT: ${PORT}
  - AGENCY_SERVICE_URL: ${AGENCY_SERVICE_URL}
  - USER_SERVICE_URL: ${USER_SERVICE_URL}
  - SCHEDULE_SERVICE_URL: ${SCHEDULE_SERVICE_URL}
  - ATTENDANCE_SERVICE_URL: ${ATTENDANCE_SERVICE_URL}
`);

const app = express();

const resolvePath = (req: Request, servicePrefix: string) => {
  return req.originalUrl;
};

// --- Middlewares Globales ---
app.use(
  cors({
    origin: ["http://localhost:3000", FRONTEND_URL, FRONTEND_APP_URL],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());

// --- Rate Limiter ---
const limiter = rateLimit({
  windowMs: 0, // 15 minutos
  max: 100, // Limita cada IP a 100 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Demasiadas solicitudes desde esta IP, por favor intenta de nuevo después de 15 minutos",
});

app.use(limiter);

const authenticateAndInjectHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    let secret = "";
    let isUserToken = false;
    let isAgencyToken = false;
    let decodedPayload: any = null;

    try {
      decodedPayload = jwt.decode(token);

      if (
        !decodedPayload ||
        typeof decodedPayload !== "object" ||
        !decodedPayload.token_type
      ) {
        logger.warn("JWT missing or invalid token_type claim");
        res
          .status(401)
          .json({ message: "Unauthorized: Invalid token format." });
        return;
      }

      if (decodedPayload.token_type === "user") {
        secret = USER_SECRET;
        isUserToken = true;
      } else if (decodedPayload.token_type === "agency") {
        secret = AGENCY_SECRET;
        isAgencyToken = true;
      } else {
        logger.warn(`Unknown token_type: ${decodedPayload.token_type}`);
        res.status(401).json({ message: "Unauthorized: Unknown token type." });
        return;
      }

      const verifiedPayload = jwt.verify(token, secret) as any;

      delete req.headers.authorization;
      if (isUserToken && verifiedPayload.userId) {
        req.headers["x-user-id"] = verifiedPayload.userId;
        if (verifiedPayload.agencyId)
          req.headers["x-agency-id"] = verifiedPayload.agencyId;
        logger.info(
          `User Authenticated (via token_type): ${verifiedPayload.userId}`
        );
      } else if (isAgencyToken && verifiedPayload.agencyId) {
        req.headers["x-agency-id"] = verifiedPayload.agencyId;
        logger.info(
          `Agency Authenticated (via token_type): ${verifiedPayload.agencyId}`
        );
      } else {
        logger.warn(
          `Verified JWT payload missing expected ID for type ${decodedPayload.token_type}`
        );

        res
          .status(401)
          .json({ message: "Unauthorized: Invalid token format." });
        return;
      }

      next();
    } catch (error: any) {
      // Errores pueden ocurrir en jwt.decode o jwt.verify
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn(`JWT verification failed: Token expired`);
        res.status(401).json({ message: "Unauthorized: Token expired." });
        return;
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn(`JWT verification failed: ${error.message}`);
        res.status(401).json({ message: "Unauthorized: Invalid token." });
        return;
      } else {
        // Otro error inesperado durante decodificación/verificación
        logger.error("Unexpected error during token processing:", error);
        res
          .status(500)
          .json({ message: "Internal server error during authentication." });
        return;
      }
    }
  } else {
    next(); // No hay token, continuar (para rutas públicas)
  }
};

// Aplicar el middleware de autenticación ANTES de los proxies
app.use(authenticateAndInjectHeaders);

// --- Rutas Base ---
app.get("/", (req: Request, res: Response) => {
  res.send("API Gateway Base");
});

// Proxy para Agency Service
app.use(
  "/v1/api/agencies",
  proxy(AGENCY_SERVICE_URL, {
    proxyReqPathResolver: (req) => resolvePath(req, "/v1/api/agencies"),
  })
);

// Proxy para User Service
app.use(
  "/v1/api/users",
  proxy(USER_SERVICE_URL, {
    proxyReqPathResolver: (req) => resolvePath(req, "/v1/api/users"),
  })
);

// Proxy para Schedule Service
app.use(
  "/v1/api/schedules",
  proxy(SCHEDULE_SERVICE_URL, {
    proxyReqPathResolver: (req) => resolvePath(req, "/v1/api/schedules"),
  })
);

// Proxy para Attendance Service
app.use(
  "/v1/api/attendance",
  proxy(ATTENDANCE_SERVICE_URL, {
    proxyReqPathResolver: (req) => resolvePath(req, "/v1/api/attendance"),
  })
);

// --- Manejador de Errores Básico ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Gateway Error:", err);
  res.status(500).json({ message: err.message || "Internal Gateway Error" });
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});
