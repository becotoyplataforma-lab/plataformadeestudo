import "server-only";
import { env } from "@/lib/env";

interface KimiModelsResponse {
  data?: Array<{
    id?: string;
    owned_by?: string;
  }>;
}

function apiKey(): string | undefined {
  return process.env.KIMI_API_KEY?.trim() || env.KIMI_API_KEY?.trim();
}

function modelsUrl(): string {
  return `${env.KIMI_BASE_URL.replace(/\/$/, "")}/models`;
}

export const KimiService = {
  isConfigured(): boolean {
    return Boolean(apiKey());
  },

  async listModels(): Promise<string[]> {
    const key = apiKey();
    if (!key) return [];

    const response = await fetch(modelsUrl(), {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Kimi API erro ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as KimiModelsResponse;
    return (payload.data ?? [])
      .map((model) => model.id?.trim())
      .filter((id): id is string => Boolean(id))
      .sort((left, right) => left.localeCompare(right));
  },
};