import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty" } // Formato bonito para desarrollo
      : undefined, // Formato JSON por defecto para producción
});

export default logger;
