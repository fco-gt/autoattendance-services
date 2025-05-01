export class HttpError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Solicitud incorrecta", details?: any) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "No autorizado", details?: any) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Acceso prohibido", details?: any) {
    super(message, 403, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Recurso no encontrado", details?: any) {
    super(message, 404, details);
  }
}

export class ConflictError extends HttpError {
  constructor(
    message = "Conflicto con el estado actual del recurso",
    details?: any
  ) {
    super(message, 409, details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Error interno del servidor", details?: any) {
    super(message, 500, details);
  }
}
