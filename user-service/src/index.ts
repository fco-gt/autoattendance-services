import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import prisma from "./db";
import { HttpError } from "./errors/HttpErrors";
import userRoutes from "./routes/user.router";
import { ZodError } from "zod";
import logger from "./logger";

// --- App Express ---
const app = express();
const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const API_BASE_PATH = `/${API_VERSION}/api`;

if (!PORT || !API_VERSION) {
  logger.error("Faltan variables de entorno. User Service no iniciará.");
  process.exit(1);
}

// --- Middlewares Globales ---
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3005"],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas Base ---
app.get("/", (req: Request, res: Response) => {
  res.send(`User Service Base - API Path: ${API_BASE_PATH}`);
});
app.get(API_BASE_PATH, (req: Request, res: Response) => {
  res.send("User Service API");
});

// --- Registro de Rutas de Usuario ---
app.use(`${API_BASE_PATH}/users`, userRoutes); // Montará las rutas de usuario

// --- Manejador de Errores Centralizado (igual que en agency-service) ---
const centralErrorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(
    `[${new Date().toISOString()}] ERROR: ${err.message}`,
    err.stack
  );

  if (err instanceof HttpError) {
    res.status(err.status).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Error de validación de entrada",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }
  res.status(500).json({ message: "Error interno del servidor" });
  return; // Añadido por consistencia
};
app.use(centralErrorHandler);

// --- Iniciar Servidor ---
const server = app.listen(PORT, () => {
  logger.info(`User Service listening on port ${PORT}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async () => {
  logger.info("Shutting down user-service...");
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await prisma.$disconnect();
      logger.info("Prisma client disconnected.");
    } catch (e) {
      logger.error("Error disconnecting Prisma", e);
    } finally {
      process.exit(0);
    }
  });
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
