import { RequestHandler, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { add, isValid } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db";
import {
  ActivateInvitationInput,
  GetUsersQueryInput,
} from "../validations/user.validations";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/HttpErrors";
import logger from "../logger";

// Selección de campos públicos del usuario
const userPublicSelect = {
  id: true,
  name: true,
  lastname: true,
  email: true,
  status: true,
  agencyId: true,
  createdAt: true,
  updatedAt: true,
};

// Verificar si existe el token de activación
export const checkActivationCode: RequestHandler = async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new BadRequestError("Código de activación requerido"));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { activationCode: token }, // Usa 'activationCode' para buscar
    });

    if (!user) {
      throw new NotFoundError("Código de activación inválido");
    }

    if (user.status !== "PENDING") {
      throw new ForbiddenError("La cuenta ya está activada");
    }

    if (user.codeExpiry && new Date() > user.codeExpiry) {
      throw new ForbiddenError("El código de activación ha expirado");
    }

    if (user.passwordHash) {
      throw new ForbiddenError("La cuenta ya está activada");
    }

    res
      .status(200)
      .json({ message: "Codigo de activación válido", isValid: true });
  } catch (error) {
    next(error);
  }
};

// Controlador para que el usuario active su cuenta con el token
export const activateInvitedUser: RequestHandler = async (req, res, next) => {
  try {
    const { token, password } = req.body as ActivateInvitationInput;

    if (!token) {
      return next(new BadRequestError("Código de activación requerido"));
    }

    if (!password) {
      return next(new BadRequestError("Contraseña requerida"));
    }

    const user = await prisma.user.findUnique({
      where: { activationCode: token },
    });

    logger.info(`User ${user?.email} activating their account`);
    logger.info(`User data: ${JSON.stringify(user)}`);

    if (!user || user.status !== "PENDING") {
      throw new NotFoundError("Invalid or expired activation token.");
    }

    if (!user.codeExpiry || new Date() > user.codeExpiry) {
      await prisma.user.delete({ where: { id: user.id } });
      throw new UnauthorizedError("Activation token has expired.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        status: "ACTIVE",
        activationCode: null,
        codeExpiry: null,
      },
      select: { id: true, email: true, name: true, agencyId: true },
    });

    // Generar token de sesión
    const jwtSecret = process.env.USER_JWT_SECRET;
    if (!jwtSecret) throw new InternalServerError("JWT Secret no configurado");

    const payload = {
      userId: updatedUser.id,
      email: updatedUser.email,
      agencyId: updatedUser.agencyId,
      token_type: "user",
    };

    const sessionToken = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });

    logger.info(`User ${updatedUser.email} activated successfully.`);
    res.status(200).json({ user: updatedUser, token: sessionToken });
  } catch (error) {
    logger.error("Error activating invited user:", error);
    next(error);
  }
};

// --- Login de Usuario ---
export const loginUser: RequestHandler = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError("Credenciales inválidas (email)");
    }

    if (user.status !== "ACTIVE" || !user.passwordHash) {
      throw new ForbiddenError(
        "La cuenta no está activa o requiere activación"
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciales inválidas (contraseña)");
    }

    const payload = {
      userId: user.id,
      email: user.email,
      agencyId: user.agencyId,
      token_type: "user",
    };

    const jwtSecret = process.env.USER_JWT_SECRET;
    if (!jwtSecret) throw new InternalServerError("JWT Secret no configurado");

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: "1h",
    });

    const { passwordHash, ...safeUser } = user;

    res
      .status(200)
      .json({ message: "Autenticación exitosa", token, user: safeUser });
  } catch (error) {
    next(error);
  }
};

// --- Obtener Datos del Usuario Autenticado ('Me') ---
export const getMe: RequestHandler = async (req, res, next) => {
  const userId = req.headers["x-user-id"] as string;

  if (!userId) {
    return next(new UnauthorizedError("No autenticado correctamente"));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect, // Devuelve campos públicos
    });

    if (!user) {
      throw new NotFoundError("Usuario autenticado no encontrado");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// --- Endpoint de Validación Interna (Ejemplo) ---
// POST /validate -> Usado por otros servicios (vía Gateway) para validar usuario/agencia
export const validateUserAgency: RequestHandler = async (req, res, next) => {
  const { userId, agencyId } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true, status: true },
    });

    const isValid =
      !!user && user.agencyId === agencyId && user.status === "ACTIVE";

    logger.info(
      { userId, agencyId, result: isValid },
      "Validación interna de usuario realizada"
    );
    res.status(200).json({ isValid });
  } catch (error) {
    logger.error(
      { err: error, userId, agencyId },
      "Error en validación interna de usuario"
    );
    res.status(200).json({ isValid: false });
  }
};

// --- Invitar Usuario ---
// POST /invite -> Usado por agencias para invitar usuarios
export const createInvitation: RequestHandler = async (req, res, next) => {
  try {
    const { email, agencyId, name, lastname } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new BadRequestError("Un usuario con ese email ya existe");
    }

    const activationToken = uuidv4();
    const expiresAt = add(new Date(), { hours: 24 }); // Token válido por 24 horas

    // Creamos el usuario directamente en estado PENDING
    const user = await prisma.user.create({
      data: {
        email,
        agencyId,
        name,
        lastname,
        status: "PENDING",
        activationCode: activationToken,
        codeExpiry: expiresAt,
      },
      select: {
        id: true,
        email: true,
        activationCode: true,
      },
    });

    logger.info(`Invitation created for email ${email} by agency ${agencyId}`);

    // Devolvemos el usuario creado (con el token) para que agency-service envíe el email
    res.status(201).json(user);
  } catch (error) {
    logger.error("Error creating invitation:", error);
    next(error);
  }
};

export const getUsersForAgency: RequestHandler = async (req, res, next) => {
  const { agencyId } = req.query as GetUsersQueryInput;

  try {
    const users = await prisma.user.findMany({
      where: { agencyId },
      select: userPublicSelect,
      orderBy: {
        createdAt: "asc",
      },
    });

    res.status(200).json(users);
  } catch (error) {
    logger.error("Error obteniendo usuarios para agencia:", error);
    next(new InternalServerError("Error obteniendo usuarios"));
  }
};
