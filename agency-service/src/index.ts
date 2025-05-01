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
import agencyRoutes from "./routes/agency.router";
import { ZodError } from "zod";
import logger from "./logger";

// --- App Express ---
const app = express();
const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const API_BASE_PATH = `/${API_VERSION}/api`;
const API_GETAWAY_URL = process.env.API_GETAWAY_URL;

if (!PORT || !API_VERSION || !API_GETAWAY_URL) {
  logger.error("Faltan variables de entorno. Agency Service no iniciará.");
  process.exit(1);
}

// --- Middlewares Globales ---
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3005", API_GETAWAY_URL],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas Base ---
app.get("/", (req: Request, res: Response) => {
  res.send(`Agency Service Base - API Path: ${API_BASE_PATH}`);
});

app.get(API_BASE_PATH, (req: Request, res: Response) => {
  res.send("Agency Service API");
});

// --- Registro de Rutas de Agencia ---
app.use(`${API_BASE_PATH}/agencies`, agencyRoutes); // Usa las rutas importadas

// --- Manejador de Errores Centralizado Mejorado ---
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
    // Manejo específico para errores de Zod
    res.status(400).json({
      message: "Error de validación de entrada",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });

    return;
  }

  // Error genérico
  res.status(500).json({ message: "Error interno del servidor" });
  return;
};
app.use(centralErrorHandler);

// --- Iniciar Servidor ---
const server = app.listen(PORT, () => {
  logger.info(`Agency Service listening on port ${PORT}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async () => {
  logger.info("Shutting down agency-service...");
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
