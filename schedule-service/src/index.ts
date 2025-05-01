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
import scheduleRoutes from "./routes/schedule.router";
import { ZodError } from "zod";
import logger from "./logger";

const app = express();
const PORT = process.env.PORT;
const API_VERSION = process.env.API_VERSION;
const API_BASE_PATH = `/${API_VERSION}/api`;

if (!PORT || !API_VERSION) {
  logger.error("Faltan variables de entorno. Schedule Service no iniciará.");
  process.exit(1);
}

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3005"],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send(`Schedule Service Base - API Path: ${API_BASE_PATH}`);
});
app.get(API_BASE_PATH, (req: Request, res: Response) => {
  res.send("Schedule Service API");
});

app.use(`${API_BASE_PATH}/schedules`, scheduleRoutes);

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
      message: "Error de validación",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }
  res.status(500).json({ message: "Error interno del servidor" });
  return;
};
app.use(centralErrorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Schedule Service listening on port ${PORT}`);
});

const gracefulShutdown = async () => {
  logger.info("Shutting down schedule-service...");
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
