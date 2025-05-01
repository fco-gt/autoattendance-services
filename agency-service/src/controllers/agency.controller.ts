import { RequestHandler, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/HttpErrors";
import logger from "../logger";
import axios from "axios";
import { sendActivationCode } from "../services/email.service";
import { InviteUserInput } from "../validations/agency.validations";

// --- Selección de Campos Públicos ---
// Para evitar devolver el passwordHash
const agencyPublicSelect = {
  id: true,
  name: true,
  domain: true,
  address: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// --- Crear Agencia ---
export const createAgency: RequestHandler = async (req, res, next) => {
  const { name, domain, password, address, phone } = req.body;
  try {
    const existingAgency = await prisma.agency.findFirst({
      where: { OR: [{ name }, { domain }] },
    });
    if (existingAgency) {
      const field = existingAgency.name === name ? "nombre" : "dominio/email";
      throw new ConflictError(`Ya existe una agencia con ese ${field}`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newAgency = await prisma.agency.create({
      data: { name, domain, passwordHash, address, phone },
      select: agencyPublicSelect,
    });

    // Generar token inmediatamente después del registro
    const jwtSecret = process.env.AGENCY_JWT_SECRET;
    if (!jwtSecret) throw new InternalServerError("JWT Secret no configurado");

    const payload = {
      agencyId: newAgency.id,
      domain: newAgency.domain,
      token_type: "agency",
    };

    const token = jwt.sign(payload, jwtSecret, {
      expiresIn: "1h",
    });

    res.status(201).json({ agency: newAgency, token });
  } catch (error) {
    if (error instanceof ConflictError) {
      return next(error);
    }
    logger.error("Error creando agencia:", error);
    next(new InternalServerError("No se pudo crear la agencia"));
  }
};

// --- Login Agencia ---
export const loginAgency: RequestHandler = async (req, res, next) => {
  const { domain, password } = req.body; // Usa 'domain' para buscar
  try {
    const agency = await prisma.agency.findUnique({
      where: { domain },
    });

    if (!agency) {
      throw new UnauthorizedError("Credenciales inválidas (dominio)");
    }
    if (!agency.isActive) {
      throw new ForbiddenError("La cuenta de la agencia está inactiva");
    }

    const isPasswordValid = await bcrypt.compare(password, agency.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciales inválidas (contraseña)");
    }

    const jwtSecret = process.env.AGENCY_JWT_SECRET;
    if (!jwtSecret) throw new InternalServerError("JWT Secret no configurado");

    const payload = {
      agencyId: agency.id,
      domain: agency.domain,
      token_type: "agency",
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });

    res.status(200).json({ message: "Autenticación exitosa", token });
  } catch (error) {
    next(error);
  }
};

// --- Obtener Datos de Agencia Autenticada ('Me') ---
export const getMyAgency: RequestHandler = async (req, res, next) => {
  const agencyId = req.headers["x-agency-id"] as string;

  if (!agencyId) {
    return next(new UnauthorizedError("No autenticado correctamente"));
  }

  try {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: agencyPublicSelect,
    });

    if (!agency) {
      // Raro, pero posible si la agencia se eliminó después de emitir el token
      throw new NotFoundError("Agencia autenticada no encontrada");
    }

    res.status(200).json(agency);
  } catch (error) {
    next(error);
  }
};

// --- Actualizar Agencia Autenticada ---
export const updateMyAgency: RequestHandler = async (req, res, next) => {
  const agencyId = req.headers["x-agency-id"] as string;
  const dataToUpdate = req.body;

  if (!agencyId) {
    return next(new UnauthorizedError("No autenticado correctamente"));
  }

  // Omitir campos sensibles o que no se deben actualizar aquí
  delete dataToUpdate.password;
  delete dataToUpdate.domain; // Por ahora no permitimos cambiar dominio/pass aquí

  try {
    // Verificar si hay algo para actualizar después de omitir campos
    if (Object.keys(dataToUpdate).length === 0) {
      throw new BadRequestError(
        "No se proporcionaron campos válidos para actualizar."
      );
    }

    const updatedAgency = await prisma.agency.update({
      where: { id: agencyId },
      data: dataToUpdate,
      select: agencyPublicSelect,
    });

    res.status(200).json(updatedAgency);
  } catch (error) {
    if (error instanceof BadRequestError) {
      return next(error);
    }
    logger.error("Error actualizando agencia:", error);
    next(new InternalServerError("No se pudo actualizar la agencia"));
  }
};

export const inviteUser: RequestHandler = async (req, res, next) => {
  try {
    const { email: userEmail } = req.body as InviteUserInput;
    const agencyId = req.headers["x-agency-id"] as string;

    const USER_SERVICE = process.env.USER_SERVICE_URL;

    if (!USER_SERVICE) {
      throw new InternalServerError(
        "No se pudo encontrar el servicio de usuarios"
      );
    }

    if (!agencyId) {
      throw new UnauthorizedError("No autorizado para invitar usuarios");
    }

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    });

    if (!agency) {
      throw new InternalServerError("Agency not found");
    }

    // 1. Llamar a user-service para crear el usuario pendiente/invitación
    let invitationData;

    logger.info(
      `Calling user-service to create invitation for ${userEmail} by agency ${agencyId}`
    );

    try {
      const response = await axios.post(
        `${USER_SERVICE}/v1/api/users/create-invitation`,
        {
          email: userEmail,
          agencyId: agencyId,
        }
      );

      invitationData = response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        logger.error(
          `Error calling user-service: ${error.response.status}`,
          error.response.data
        );

        throw new BadRequestError(
          error.response.data.message ||
            "Error al crear invitación en el servicio de usuarios"
        );
      } else {
        logger.error("Failed to call user-service:", error);
        throw new InternalServerError(
          "No se pudo comunicar con el servicio de usuarios"
        );
      }
    }

    if (!invitationData?.activationCode) {
      throw new InternalServerError(
        "El servicio de usuarios no devolvió el código de activación"
      );
    }

    // 2. Enviar el email de invitación
    const activationLink = `${process.env.FRONTEND_URL}/activate-invitation?token=${invitationData.activationCode}`; // URL del frontend

    const agencyName = agency.name;
    const activationCode = invitationData.activationCode;

    await sendActivationCode(
      userEmail,
      agencyName,
      activationLink,
      activationCode
    ); // TODO: Cambiar nombre de función

    logger.info(`Invitation email sent to ${userEmail} for agency ${agencyId}`);
    res.status(200).json({ message: "Invitation sent successfully." });
  } catch (error) {
    logger.error("Error sending invitation:", error);
    next(error);
  }
};
