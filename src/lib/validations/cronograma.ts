import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(3, "Título deve ter no mínimo 3 caracteres").max(200),
  description: z.string().max(1000).optional().nullable(),
  subject_id: z.string().uuid().optional().nullable(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  duration_min: z.coerce.number().int().min(5).max(720).default(60),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["pendente", "concluida", "adiada"]).optional(),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(120),
  color: z.string().max(20).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  carga_horaria_total: z.coerce.number().int().min(0).max(100000).default(0),
});


