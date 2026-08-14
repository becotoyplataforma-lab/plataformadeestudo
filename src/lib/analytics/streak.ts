/**
 * Cálculo de sequência de estudos (streak) em TS puro — testável.
 * Um dia conta como "ativo" se o usuário teve ≥1 atividade (questão, tarefa
 * concluída ou revisão).
 */
export interface StreakInput {
  /** Datas ISO (yyyy-MM-dd) com atividade */
  activityDates: string[];
  today: string; // yyyy-MM-dd (local)
}

export interface StreakResult {
  current: number;
  /** true se ainda hoje não houve atividade */
  needsToday: boolean;
}

function parseISO(iso: string): Date {
  // Evita problema de fuso: interpreta como data local
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeStreak({ activityDates, today }: StreakInput): StreakResult {
  const set = new Set(activityDates);
  const todayDate = parseISO(today);

  // Sequência a partir de hoje (ou de ontem, se hoje ainda sem atividade)
  let current = 0;
  let cursor = todayDate;

  if (set.has(toISO(cursor))) {
    // hoje tem atividade → conta a partir de hoje
    while (set.has(toISO(cursor))) {
      current++;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    }
    return { current, needsToday: false };
  }

  // Hoje sem atividade: sequência conta a partir de ontem
  cursor = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 1);
  while (set.has(toISO(cursor))) {
    current++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return { current, needsToday: true };
}

/** Dias ativos distintos a partir de um array de timestamps ISO completos */
export function distinctActivityDates(timestamps: string[]): string[] {
  const set = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    set.add(toISO(d));
  }
  return [...set];
}

/** Data de hoje em ISO (yyyy-MM-dd) no fuso local */
export function todayISO(): string {
  return toISO(new Date());
}
