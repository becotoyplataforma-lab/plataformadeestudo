import { z } from "zod";

export const sendMessageSchema = z.object({
  session_id: z.string().uuid().optional().nullable(),
  message: z.string().min(1, "Mensagem vazia").max(4000),
  model: z.enum(["flash", "pro"]).default("flash"),
  subject_id: z.string().uuid().optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
});

export const newSessionSchema = z.object({
  title: z.string().max(200).optional().default("Nova conversa"),
  subject_id: z.string().uuid().optional().nullable(),
  model: z.enum(["flash", "pro"]).default("flash"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
