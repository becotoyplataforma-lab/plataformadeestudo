import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de resposta do cadastro (POST /api/register). */
export const RegisterResponseDtoSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    plano: z.enum(["free", "pro", "intensivo"]).default("free"),
  }),
});
export type RegisterResponseDto = OutputOf<typeof RegisterResponseDtoSchema>;

export function toRegisterResponseDto(input: unknown): RegisterResponseDto | null {
  return parseDto(RegisterResponseDtoSchema, input);
}

/** DTO do perfil (retorna ao cliente — sem campos internos). */
export const ProfileDtoSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  email: z.string().email().nullable(),
  avatar_url: z.string().url().nullable(),
  plano: z.enum(["free", "pro", "intensivo"]),
  nivel: z.enum(["iniciante", "intermediario", "avancado"]),
  concurso_alvo: z.string().nullable(),
  banca_preferida: z.string().nullable(),
  meta_diaria_min: z.number().int().min(0),
  modelo_ia_padrao: z.enum(["flash", "pro"]),
  created_at: z.string(),
});
export type ProfileDto = OutputOf<typeof ProfileDtoSchema>;

export function toProfileDto(input: unknown): ProfileDto | null {
  return parseDto(ProfileDtoSchema, input);
}
