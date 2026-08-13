"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionUpdateProfile } from "@/app/(dashboard)/perfil/actions";
import type { ContestOption, PositionOption, Profile } from "@/types";

export function ProfileForm({
  profile,
  contests,
  positions,
}: {
  profile: Profile;
  contests: ContestOption[];
  positions: PositionOption[];
}) {
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [nivel, setNivel] = React.useState<Profile["nivel"]>(profile.nivel);
  const [concurso, setConcurso] = React.useState(profile.concurso_alvo ?? "");
  const [banca, setBanca] = React.useState(profile.banca_preferida ?? "");
  const [meta, setMeta] = React.useState(profile.meta_diaria_min);
  const [modelo, setModelo] = React.useState<Profile["modelo_ia_padrao"]>(
    profile.modelo_ia_padrao
  );
  const [loading, setLoading] = React.useState(false);
  const [contestId, setContestId] = React.useState(profile.contest_id ?? "");
  const [positionId, setPositionId] = React.useState(profile.position_id ?? "");

  function onContestChange(v: string) {
    setContestId(v);
    // Se o cargo atual não pertence ao novo concurso, limpa (evita combinação inválida).
    if (positionId && !positions.some((p) => p.id === positionId && p.contest_id === v)) {
      setPositionId("");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await actionUpdateProfile({
      full_name: fullName,
      nivel,
      concurso_alvo: concurso || null,
      banca_preferida: banca || null,
      contest_id: contestId || null,
      position_id: positionId || null,
      meta_diaria_min: meta,
      modelo_ia_padrao: modelo,
    });
    setLoading(false);
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={profile.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              O e-mail é usado para login e recuperação de senha.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objetivo e nível</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="concurso">Concurso alvo</Label>
              <Input
                id="concurso"
                value={concurso}
                onChange={(e) => setConcurso(e.target.value)}
                placeholder="Ex.: TCE-SP, PF, BB..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banca">Banca preferida</Label>
              <Input
                id="banca"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex.: CEBRASPE, FGV, VUNESP..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nivel">Nível de conhecimento</Label>
            <Select value={nivel} onValueChange={(v) => setNivel(v as Profile["nivel"])}>
              <SelectTrigger id="nivel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O Professor IA adapta o nível de detalhe das explicações.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferências de estudo e IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta">Meta diária (minutos)</Label>
            <Input
              id="meta"
              type="number"
              min={15}
              max={720}
              step={5}
              value={meta}
              onChange={(e) => setMeta(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modelo">Modelo de IA padrão</Label>
            <Select
              value={modelo}
              onValueChange={(v) => setModelo(v as Profile["modelo_ia_padrao"])}
            >
              <SelectTrigger id="modelo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flash">V4 Flash — rápido e econômico</SelectItem>
                <SelectItem value="pro">V4 Pro — raciocínio profundo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concurso e Cargo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="concurso-id">Concurso</Label>
            <Select value={contestId} onValueChange={onContestChange}>
              <SelectTrigger id="concurso-id">
                <SelectValue placeholder="Nenhum concurso selecionado" />
              </SelectTrigger>
              <SelectContent>
                {contests.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vincular um concurso faz o planejamento considerar o peso do edital.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo-id">Cargo / Posição</Label>
            <Select
              value={positionId}
              onValueChange={setPositionId}
              disabled={!contestId}
            >
              <SelectTrigger id="cargo-id">
                <SelectValue placeholder="Cargo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {positions
                  .filter((p) => p.contest_id === contestId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Opcional — sem cargo, vale o peso geral do edital.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar alterações
      </Button>
    </form>
  );
}
