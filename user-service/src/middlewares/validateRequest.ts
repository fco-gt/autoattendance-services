import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { BadRequestError, InternalServerError } from "../errors/HttpErrors";

export const validateRequest =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        return next(new BadRequestError("Error de validación", errorMessages));
      } else {
        return next(
          new InternalServerError("Error inesperado durante la validación")
        );
      }
    }
  };
