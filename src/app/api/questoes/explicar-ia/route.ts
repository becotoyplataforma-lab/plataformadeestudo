import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai/deepseek";
import type { ChatMessage } from "@/lib/ai/types";

export interface ExplicarQuestaoRequest {
  questaoId: string;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
  gabarito: string;
  letraMarcada?: string | null;
  disciplina?: string;
  assunto?: string;
  banca?: string;
}

function gerarExplicacaoFallback(dados: ExplicarQuestaoRequest): string {
  const { enunciado, alternativas, gabarito, letraMarcada, disciplina, assunto, banca } = dados;
  const textoGabarito = alternativas.find((a) => a.letra === gabarito)?.texto ?? gabarito;
  const textoMarcado = letraMarcada ? alternativas.find((a) => a.letra === letraMarcada)?.texto : null;

  let secaoErro = "";
  if (letraMarcada && letraMarcada !== gabarito) {
    secaoErro = `
### ❌ 1. Diagnóstico do seu Erro na Alternativa (${letraMarcada})
Você selecionou a **Alternativa (${letraMarcada})**: _"${textoMarcado}"_.

**Por que essa opção é uma pegadinha típica:**
Esta alternativa costuma induzir ao erro porque aparenta estar correta em uma leitura superficial. No entanto, ela desvia da regra central cobrada pela banca ${banca || "FGV"}:
- Não atende a todos os critérios exigidos pelo enunciado.
- Apresenta um distrator comum baseado em falso paralelismo ou interpretação extensiva.
`;
  } else if (letraMarcada === gabarito) {
    secaoErro = `
### 🎉 1. Parabéns! Você Acertou em Cheio!
Você escolheu a **Alternativa (${gabarito})**, que é exatamente o gabarito oficial da banca ${banca || "FGV"}.
`;
  }

  return `## 🤖 Resolução do Professor IA · ConcursoAI

${secaoErro}

### ✅ 2. Por que a Alternativa (${gabarito}) é o Gabarito Correto?
A resposta oficial e correta é a **Alternativa (${gabarito})**: _"${textoGabarito}"_.

**Fundamentação passo a passo:**
1. **Identificação do núcleo da questão:** O item exige o domínio prático de **${assunto || disciplina || "conteúdo programático"}**.
2. **Aplicação do conceito:** Ao examinar o comando e cotejar com o texto do enunciado, observa-se que a alternativa **(${gabarito})** satisfaz com exatidão a regra oficial estabelecida pela doutrina e pela banca.
3. **Eliminação dos distratores:** As demais alternativas contêm imprecisões ou extrapolações que as tornam inválidas frente ao gabarito oficial.

---

### 💡 3. Macete do Professor para a Prova
> **Regra de Ouro da Banca ${banca || "FGV"}:**
> Em questões de ${disciplina || "concurso"}, sempre isole o termo regente ou a fórmula nuclear antes de ler as alternativas. Desconfie de alternativas com termos categóricos ("sempre", "nunca", "em qualquer hipótese") e verifique sempre a literalidade do texto!
`;
}

export async function POST(req: Request) {
  try {
    const dados: ExplicarQuestaoRequest = await req.json().catch(() => null);

    if (!dados || !dados.enunciado || !dados.gabarito) {
      return NextResponse.json(
        { error: "Dados da questão incompletos." },
        { status: 400 }
      );
    }

    const { enunciado, alternativas, gabarito, letraMarcada, disciplina, assunto, banca } = dados;

    const listaAlts = (alternativas || [])
      .map((a) => `(${a.letra}) ${a.texto}`)
      .join("\n");

    const promptUsuario = `
QUESTÃO:
Disciplina: ${disciplina || "Geral"}
Assunto: ${assunto || "Geral"}
Banca: ${banca || "FGV / CBM-RJ"}

ENUNCIADO:
${enunciado}

ALTERNATIVAS:
${listaAlts}

GABARITO OFICIAL: (${gabarito})
${letraMarcada ? `O ALUNO MARCOU: (${letraMarcada}) ${letraMarcada === gabarito ? "ACERTOU!" : "ERROU A QUESTÃO"}` : "O aluno ainda não respondeu ou solicitou explicação prévia."}

Por favor, elabore uma explicação pedagógica, clara e direta:
1. Se o aluno marcou errado (${letraMarcada}), explique por que aquela alternativa específica é um distrator/pegadinha e onde está o erro conceitual.
2. Demonstre por que a alternativa oficial (${gabarito}) é a correta passo a passo com base na regra/lei/fórmula.
3. Dê uma "Dica de Ouro" rápida e mnemônica para o aluno nunca mais errar este tipo de questão em concursos públicos.
`.trim();

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Você é o Professor IA do ConcursoAI, um tutor amigável, didático e altamente especializado em concursos públicos brasileiros (especialmente CBM-RJ e banca FGV). Formate sua resposta em Markdown limpo e atraente com emojis temáticos, negritos e listas.",
      },
      {
        role: "user",
        content: promptUsuario,
      },
    ];

    try {
      const resIA = await chatCompletion({
        model: "flash",
        messages,
        temperature: 0.3,
        maxTokens: 1200,
      });

      if (resIA && resIA.content && resIA.content.trim().length > 50) {
        return NextResponse.json({
          explicacao: resIA.content,
          origem: "deepseek",
        });
      }
    } catch (aiErr) {
      console.warn("[explicar-ia] IA indisponível ou sem chave, usando gerador estruturado:", aiErr);
    }

    // Fallback pedagógico imediato e garantido
    const explicacaoFallback = gerarExplicacaoFallback(dados);
    return NextResponse.json({
      explicacao: explicacaoFallback,
      origem: "fallback_estruturado",
    });
  } catch (err) {
    console.error("[explicar-ia] Erro no endpoint:", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a explicação." },
      { status: 500 }
    );
  }
}
