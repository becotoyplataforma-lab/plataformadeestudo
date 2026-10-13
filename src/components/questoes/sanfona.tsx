import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Sanfona fechada, renderizada em servidor.
 *
 * `<details>`/`<summary>` em vez do Accordion do Radix: o card aparece 20 vezes
 * por página, e cada instância do Radix puxa estado de cliente para algo que é
 * só abrir e fechar. Sem JavaScript o conteúdo continua acessível, o estado
 * fechado é o padrão (nada de gabarito à mostra antes de responder) e a
 * profundidade de DOM do card não explode — que é o que travava o seletor do
 * smoke E2E quando a trilha de metadados ficava longa demais.
 */
export interface SanfonaProps {
  rotulo: string;
  children: ReactNode;
  /** Marcador estável para teste; também serve de âncora de deep link. */
  id?: string;
}

export function Sanfona({ rotulo, children, id }: SanfonaProps) {
  return (
    <details
      className="group border-t border-border"
      data-sanfona={id ?? rotulo.toLowerCase()}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-card-foreground [&::-webkit-details-marker]:hidden">
        {rotulo}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-5 pb-4 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}

export default Sanfona;
