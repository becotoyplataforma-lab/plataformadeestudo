import { NextResponse } from "next/server";
import { CADERNO_GERAL } from "@/lib/questoes/cadernos";
import { carregarCaderno } from "@/lib/questoes/dados-caderno";
import { removerCopiasIdenticas } from "@/lib/questoes/cadernos";
import { alternativasOrdenadas, gabaritoConfiavel } from "@/lib/questoes/procedencia";
import { PRESETS_SIMULADOS, type QuestaoSimulado } from "@/lib/simulados/tipos";

function embaralhar<T>(array: T[]): T[] {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i]!, copia[j]!] = [copia[j]!, copia[i]!];
  }
  return copia;
}

export async function POST(req: Request) {
  try {
    const corpo = await req.json().catch(() => ({}));
    const presetId = corpo.presetId as string | undefined;

    let titulo = "Simulado Customizado";
    let duracaoMinutos = Number(corpo.duracaoMinutos) || 30;
    let totalQuestoes = Number(corpo.totalQuestoes) || 20;
    let distribuicao: { disciplina: string; quantidade: number }[] = [];

    const preset = PRESETS_SIMULADOS.find((p) => p.id === presetId);
    if (preset) {
      titulo = preset.titulo;
      duracaoMinutos = preset.duracaoMinutos;
      totalQuestoes = preset.totalQuestoes;
      distribuicao = preset.distribuicao;
    } else {
      const disciplinasSelecionadas: string[] = Array.isArray(corpo.disciplinas) && corpo.disciplinas.length > 0
        ? corpo.disciplinas
        : ["Língua Portuguesa", "Matemática"];

      const qtdPorDisciplina = Math.floor(totalQuestoes / disciplinasSelecionadas.length);
      const resto = totalQuestoes % disciplinasSelecionadas.length;

      distribuicao = disciplinasSelecionadas.map((disc, idx) => ({
        disciplina: disc,
        quantidade: qtdPorDisciplina + (idx === 0 ? resto : 0),
      }));
    }

    // Carrega o acervo geral em memória
    const carga = carregarCaderno(CADERNO_GERAL);
    if (!carga || carga.itens.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma questão disponível no acervo." },
        { status: 500 }
      );
    }

    const acervo = removerCopiasIdenticas(carga.itens);
    const validas = acervo.itens
      .map((item) => item.questao)
      .filter((q) => gabaritoConfiavel(q) && q.enunciado && q.enunciado.trim().length > 0);

    const questoesSelecionadas: QuestaoSimulado[] = [];

    // Seleciona por cota de disciplina
    for (const d of distribuicao) {
      const doGrupo = validas.filter(
        (q) => q.disciplina?.toLowerCase() === d.disciplina.toLowerCase()
      );
      const embaralhadas = embaralhar(doGrupo);
      const selecionadas = embaralhadas.slice(0, d.quantidade);

      for (const q of selecionadas) {
        questoesSelecionadas.push({
          id: q.id_local,
          codigo: q.codigo,
          disciplina: q.disciplina || d.disciplina,
          assunto: q.assunto ?? undefined,
          banca: q.banca,
          ano: q.ano,
          orgao: q.orgao,
          enunciado: q.enunciado,
          alternativas: alternativasOrdenadas(q),
          gabarito: q.gabarito!,
          tipo: q.tipo,
        });
      }
    }

    // Caso alguma disciplina não tenha atingido a cota, completa com o restante
    if (questoesSelecionadas.length < totalQuestoes) {
      const idsJaColocados = new Set(questoesSelecionadas.map((q) => q.id));
      const faltam = totalQuestoes - questoesSelecionadas.length;
      const sobras = embaralhar(validas.filter((q) => !idsJaColocados.has(q.id_local))).slice(0, faltam);

      for (const q of sobras) {
        questoesSelecionadas.push({
          id: q.id_local,
          codigo: q.codigo,
          disciplina: q.disciplina || "Geral",
          assunto: q.assunto ?? undefined,
          banca: q.banca,
          ano: q.ano,
          orgao: q.orgao,
          enunciado: q.enunciado,
          alternativas: alternativasOrdenadas(q),
          gabarito: q.gabarito!,
          tipo: q.tipo,
        });
      }
    }

    // Embaralha a ordem final das questões para alternar matérias como em uma prova real
    const questoesFinal = embaralhar(questoesSelecionadas);

    const simuladoId = "sim-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

    return NextResponse.json({
      id: simuladoId,
      titulo,
      duracaoMinutos,
      totalQuestoes: questoesFinal.length,
      questoes: questoesFinal,
    });
  } catch (error) {
    console.error("[simulados/gerar] Erro:", error);
    return NextResponse.json(
      { error: "Falha ao gerar simulado." },
      { status: 500 }
    );
  }
}
