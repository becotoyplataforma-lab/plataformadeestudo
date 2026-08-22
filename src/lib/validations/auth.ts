import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Informe seu nome completo")
    .max(120, "Nome muito longo"),
  email: z.string().email("E-mail inválido").max(254),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .max(72)
    .regex(/[A-Za-z]/, "A senha deve conter letras")
    .regex(/[0-9]/, "A senha deve conter números"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
