import { z } from "zod";

export const sendMessageSchema = z.object({
  session_id: z.string().uuid().optional().nullable(),
  message: z.string().min(1, "Mensagem vazia").max(4000),
  model: z.enum(["flash", "pro", "kimi"]).default("flash"),
  subject_id: z.string().uuid().optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
});


