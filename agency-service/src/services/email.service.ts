import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import logger from "../logger";

const transport = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASSWORD,
  },
});

async function compileTemplate(
  templateName: string,
  data: object
): Promise<string> {
  try {
    const filePath = path.join(
      __dirname,
      "..",
      "templates",
      `${templateName}.hbs`
    );

    const source = await fs.readFile(filePath, "utf-8");
    const template = handlebars.compile(source);
    return template(data);
  } catch (error) {
    logger.error(
      { err: error, templateName },
      "Error compilando plantilla de email"
    );
    throw new Error(`No se pudo compilar la plantilla: ${templateName}`);
  }
}
export const sendActivationCode = async (
  to: string,
  agencyName: string,
  activationLink: string,
  activationCode: string
): Promise<void> => {
  try {
    const htmlContent = await compileTemplate("activationEmail", {
      agencyName,
      activationLink,
      code: activationCode,
    });

    const mailOptions: SendMailOptions = {
      from: "AutoAttendance " + `${process.env.MAILTRAP_FROM}`,
      to: to,
      subject: "Activa tu cuenta de AutoAttendance | Agencia " + agencyName,
      html: htmlContent,
    };

    const info = await transport.sendMail(mailOptions);
    logger.info(
      { info, to, agencyName },
      "Correo de activación enviado correctamente"
    );
  } catch (error) {
    logger.error(
      { err: error, to, agencyName },
      "Error enviando correo de activación"
    );
    throw new Error("No se pudo enviar el correo de activación");
  }
};
