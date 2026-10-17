# derived_copy_cleaner

Agente responsável por sanear **cópias derivadas** de apostilas. Ele expurga o registro
interno legado do arquivo (DocInfo e XMP), neutraliza conteúdo ativo que
executa código e **não toca a camada visual** da página.

| Item | Regra |
| --- | --- |
| Escopo | Somente `target == "copia_derivada"`; nunca originais. Outro alvo levanta `ValueError`. |
| Metadados | Sanitização completa por padrão: técnicos, marca-d'água, autoria/origem/procedência e identificação saem todos. |
| Camada visual | Intocada e validada: page streams, texto renderizado, imagens, XObjects/Form XObjects, geometria e carimbos visíveis. |
| Conteúdo ativo | `/JavaScript`, `/JS`, `/AA`, `/Names/JavaScript` e `/OpenAction` de ação perigosa são neutralizados. |
| Falha fechada | PDF criptografado, assinado/protegido, malformado ou com saída visualmente diferente aborta com `ValueError`. |
| Ícone / marca | Apenas identificador da ferramenta. `marca_deepseek.ativado: false` é o padrão; nenhuma marca visual é desenhada. |
| Testes | Apenas PDFs sintéticos gerados em runtime com `reportlab` e `pikepdf`. Nada de apostilas reais, banco ou storage. |

**Nota sobre autoria.** A diretiva de 2026-10-11 redefine a cópia derivada
intermediária como documento **sem registro legado**: `author`, `creator`,
`producer`, `owner`, `origem`, `source` e `origin` saem do arquivo para que o
operador reinsera os metadados consolidados depois. Nada disso é perdido:
cada chave removida fica no relatório de auditoria com o valor original.
`docs/KNOWLEDGE_PIPELINE.md` (linha 59) e `AGENTS.md` (linhas 43-45) proíbem
remover autoria do **texto editorial** processado pelo `transform` dos
provedores MCP, e é exatamente isso que continua proibido aqui: o texto
visível, os carimbos desenhados e a marca de plataforma visível permanecem
byte a byte. O conflito de leitura está registrado em
`RELATORIO-SANITIZACAO-DEEPSEEK.md` na raiz do repositório.

## Políticas

Duas políticas convivem e são endereçáveis pelo nome. A completa é a ativa.

| Política | Nome | DocInfo | XMP | Autoria / procedência | Marca-d'água |
| --- | --- | --- | --- | --- | --- |
| **Completa** (padrão) | `sanitizacao_completa_metadados_legados` | `wipe` total, `Info` sai do trailer | stream removido | removida (registrada para reinserção) | removida sempre |
| Conservadora (legada) | `regra_por_valor_conservadora` | remoção por chave | nós técnicos removidos, restante reescrito | preservada | removida só quando o valor é estritamente instrumental |

```python
from agents.derived_copy_cleaner import policy

policy.decisao_para_chave("Author", "Fulano")
# ('remover', 'autoria/origem legada expurgada para reinsercao consolidada')

policy.decisao_para_chave("Author", "Fulano", policy.POLITICA_CONSERVADORA)
# ('preservar', 'titularidade/procedencia obrigatoria nesta politica')
```

`classificar_valor_marca_dagua` continua disponível. Na política completa ele
virou **rótulo de auditoria**: o valor com titularidade é removido do mesmo
jeito, mas o relatório avisa que carregava autoria.

## Arquitetura

```
agents/derived_copy_cleaner/
├── agent.py                   # orquestração, escopo e config.yaml
├── policy.py                  # ÚNICA fonte de verdade das decisões
├── pdf_engine.py              # único módulo que toca bytes de PDF (pikepdf)
├── metadata_cleaner.py        # fachada estável para chamadores antigos
├── sanitizer_stripper.py      # remoção de sanitização e marca (dict)
├── icon_policy.py             # política do ícone DeepSeek
├── synthetic_pdf_fixtures.py  # PDFs sintéticos de teste (reportlab/pikepdf)
├── config.yaml                # política ativa, flags e bloqueios
└── tests/test_agent.py        # 27 testes
```

`pdf_engine.sanitizar_pdf` é o ponto único: lê de um buffer próprio (a
entrada nunca é mutada), bloqueia criptografado/assinado/malformado,
neutraliza ações, expurga DocInfo e XMP, salva sem recriar metadado
(`fix_metadata_version=False`) e **só devolve** se a saída reabrir com o
mesmo número de páginas, MediaBox, hash de cada page stream, inventário de
XObjects e texto extraído com `pypdfium2`.

## Instalação

```powershell
pip install -r agents/derived_copy_cleaner/requirements.txt
```

## Uso

Sanitização de um PDF real (bytes) com relatório de auditoria:

```python
from agents.derived_copy_cleaner.metadata_cleaner import sanitizar_pdf_com_relatorio

pdf_limpo, relatorio = sanitizar_pdf_com_relatorio(pdf_bytes)

print(relatorio["politica"])                # sanitizacao_completa_metadados_legados
print(relatorio["docinfo_removido"])        # chave, valor original, grupo e motivo
print(relatorio["acoes_neutralizadas"])     # /Root/JavaScript, /Page/OpenAction, ...
print(relatorio["metadados_a_reinserir"])   # inventario para o operador
print(relatorio["validacao"]["texto_igual"])
```

Pelo agente (revalida o escopo e aceita `config.yaml`):

```python
from agents.derived_copy_cleaner.agent import DerivedCopyCleaner

agente = DerivedCopyCleaner(target="copia_derivada")
resultado = agente.sanitizar_pdf(pdf_bytes)
print(resultado["relatorio"]["paginas"], resultado["relatorio"]["xmp_stream_removido"])
```

API antiga, mantida com o mesmo motor por baixo:

```python
from agents.derived_copy_cleaner.metadata_cleaner import limpar_metadados_pdf

pdf_limpo = limpar_metadados_pdf(pdf_bytes)   # bytes de volta, sem DocInfo nem XMP
```

Metadados em dicionário (registro interno do canvas):

```python
from agents.derived_copy_cleaner.agent import limpar_copia_derivada

documento = {
    "sanitizado": True,
    "marca": "MARCA-X",
    "metadados": {"author": "Fulano", "watermark": "WM", "titulo": "Apostila"},
}

resultado = limpar_copia_derivada(documento, target="copia_derivada")
print(resultado["documento"]["metadados"])   # {} (política completa)
print(resultado["registro_removido"])        # o que reinserir, com valores originais
print(resultado["claims"])                   # authorship/endorsement/origin = False
```

Tentar usar outro alvo levanta erro:

```python
limpar_copia_derivada(documento, target="original")   # ValueError
```

## Relatório de auditoria (`RelatorioSanitizacao`)

| Campo | Conteúdo |
| --- | --- |
| `politica` | nome da política aplicada |
| `paginas` | contagem de páginas conferida |
| `docinfo_removido` | lista de `{chave, valor, grupo, motivo}` de cada campo expurgado |
| `docinfo_preservado` | chaves que ficaram (só na política conservadora) |
| `metadados_a_reinserir` | mapa chave (sem barra, minúscula) para valor original |
| `xmp_stream_removido`, `xmp_bytes_antes`, `xmp_nos_removidos` | o que aconteceu com o pacote XMP |
| `acoes_neutralizadas`, `acoes_remanescentes` | marcadores arrancados e confirmação de que nada sobrou |
| `openaction_preservado` | `/OpenAction` de navegação interna (`/GoTo`) preservado |
| `assinaturas_detectadas` | marcadores que motivaram o bloqueio |
| `id_removido` | se o `/ID` do trailer foi expurgado |
| `marca_deepseek` | aplicado, modo e motivo (padrão: não aplicado) |
| `validacao` | checagens fail-closed da camada visual e da imutabilidade da entrada |
| `sha256_entrada`, `sha256_saida` | pegadas para o log do pipeline |

## Bloqueios (falha fechada)

| Condição | Exceção |
| --- | --- |
| Bytes sem assinatura `%PDF` ou estrutura ilegível | `PdfMalformadoBloqueado` |
| PDF criptografado | `PdfCriptografadoBloqueado` |
| PDF assinado ou protegido (`/Sig` com `/ByteRange`, `/AcroForm/SigFlags`, campo `/FT=/Sig`, `/XFA`, `/Perms`) | `PdfAssinadoBloqueado` |
| Saída não reproduz a camada visual da entrada | `ValidacaoSaidaBloqueada` |

Todas herdam de `ErroSanitizacaoPdf`, que herda de `ValueError`, então o
pipeline que já tratava `ValueError` continua funcionando. A detecção de
assinatura é **heurística estrutural**: ela procura os marcadores do formato,
não verifica a validade criptográfica da assinatura.

## Marca DeepSeek

`config.yaml` traz `marca_deepseek.ativado: false`. Nesse padrão o agente não
desenha nada e não escreve nenhum metadado próprio: a saída fica sem registro
legado nenhum. Se ativado em modo `proveniencia`, o agente escreve apenas
`Producer` e `Creator` no DocInfo depois da sanitização (mutação aditiva,
nunca por cima da camada visual). Modo `visual` é recusado.

## Testes

```powershell
python -m pytest agents/derived_copy_cleaner/tests/test_agent.py -v
```

Os sete testes obrigatórios originais continuam (com as asserções de autoria
invertidas para remoção, conforme a diretiva) e há dezoito coberturas novas:
expurgo de todas as chaves legadas em bytes reais, relatório de auditoria,
XMP removido, política conservadora preservando autoria, conteúdo ativo
neutralizado, `/OpenAction` de navegação preservado, carimbo visual e Form
XObject intactos, páginas e geometria, texto renderizado, bloqueio de
criptografado/assinado/malformado, imutabilidade da entrada, marca desativada
por padrão e config/README alinhados à política.