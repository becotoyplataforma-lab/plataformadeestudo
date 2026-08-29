import type { Metadata } from "next";
import { DeepSeek } from "@lobehub/icons";

export const metadata: Metadata = {
  title: "Ícones DeepSeek",
  description:
    "Visualização dos ícones oficiais DeepSeek (baleia) em diferentes tamanhos e variantes.",
};

const sizes = [16, 24, 32, 48, 64, 96, 128];

function VariantCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: (size: number) => React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-end gap-8">
        {sizes.map((size) => (
          <div key={size} className="flex flex-col items-center gap-2">
            {children(size)}
            <span className="text-xs text-muted-foreground">{size}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeepSeekIconsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <DeepSeek size={48} />
          <h1 className="text-3xl font-bold tracking-tight">Ícones DeepSeek</h1>
        </div>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Logotipo oficial da DeepSeek (baleia) renderizado via{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">@lobehub/icons</code>.
          Confira as variantes e tamanhos disponíveis.
        </p>
      </header>

      <div className="space-y-8">
        <VariantCard
          title="Padrão (Mono)"
          description="Ícone monocromático que herda a cor do texto atual."
        >
          {(size) => <DeepSeek size={size} />}
        </VariantCard>

        <VariantCard
          title="Colorida (Color)"
          description="Versão com as cores oficiais da marca DeepSeek."
        >
          {(size) => <DeepSeek.Color size={size} />}
        </VariantCard>

        <VariantCard
          title="Avatar"
          description="Versão em formato de avatar, ideal para perfis e avatares."
        >
          {(size) => <DeepSeek.Avatar size={size} />}
        </VariantCard>

        <VariantCard
          title="Combinada (Combine)"
          description="Ícone combinado com o texto da marca."
        >
          {(size) => <DeepSeek.Combine size={size} />}
        </VariantCard>

        <VariantCard
          title="Texto (Text)"
          description="Apenas o texto da marca DeepSeek."
        >
          {(size) => <DeepSeek.Text size={size} />}
        </VariantCard>
      </div>
    </div>
  );
}
