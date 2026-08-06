# ENTITY STANDARDS

> Padrão obrigatório para TODAS as entidades do banco de dados.
> Somente padrões — não define entidades, tabelas ou campos específicos.
> Base para a futura geração do modelo físico e do schema SQL.
> Sem SQL, sem migrations. Documentos anteriores não foram alterados.

---

## IDENTIFIER

- Toda entidade possui uma chave primária surrogada UUID.
- A chave primária é gerada pelo banco.
- Chaves naturais (de negócio) são expressas como constraints de unicidade, não como PK.
- Não usar chaves numéricas sequenciais expostas.
- Identificadores não contêm informação de negócio.

## AUDIT

- Toda entidade possui created_at (imutável após criação).
- Toda entidade possui updated_at (atualizado a cada alteração).
- Entidades com propriedade registram created_by e updated_by quando aplicável.
- Entidades com ciclo de vida registram o marcador de remoção (soft delete).
- Campos de auditoria não são alteráveis pela aplicação cliente.

## LIFECYCLE

- Estados possíveis seguem o ciclo: Created, Updated, Active/Inactive, Archived, Deleted.
- Estados específicos de negócio são modelados como status explícito quando necessário.
- Transições de estado são validadas na camada de serviço.
- Estados não são derivados implicitamente sem necessidade.
- Ciclo de vida é refletido em eventos de domínio.

## OWNERSHIP

- Entidade pertencente a usuário possui referência de propriedade (user_id).
- Entidade de catálogo compartilhado não possui dono individual (leitura pública, escrita curada).
- Entidade de sistema/global não possui dono.
- Ownership determina as políticas de RLS.
- Ownership não é alterado pela aplicação cliente sem autorização.

## RELATIONSHIPS

### One-to-One
- Implementada com chave estrangeira no lado filho.
- Unicidade garantida por constraint única.
- Sem cascade de exclusão física; preferir soft delete.

### One-to-Many
- Chave estrangeira no lado "many".
- Cascade apenas quando o filho não faz sentido sem o pai.
- Preferir soft delete sobre exclusão física em cascata.

### Many-to-Many
- Implementada com entidade associativa (junction).
- A entidade associativa possui chave composta ou chave própria UUID.
- Não usar arrays embutidos para relacionamentos.

## NAMING

### Tabelas
- Plural, snake_case.

### Colunas
- snake_case.

### PK
- nome padrão: id.

### FK
- <tabela_origem_singular>_id.

### Índices
- idx_<tabela>_<colunas>.

### Constraints
- Unicidade: <tabela>_<coluna>_key.
- FK: fk_<tabela>_<referencia>.
- Check: chk_<tabela>_<regra>.

### Enums
- Tipo: singular snake_case.
- Valores: lower snake_case.

### Views
- Prefixo v_.

### Materialized Views
- Prefixo mv_.

## VERSIONING

- Estrutura evolui exclusivamente por migrations.
- Migrations são aditivas e reversíveis quando possível.
- Migrations aplicadas não são alteradas.
- Alterações posteriores criam nova migration.
- Ordem de aplicação é sequencial e rastreável.

## SOFT DELETE

- Remoção lógica por padrão.
- Uso de marcador de exclusão (data de remoção).
- Consultas filtram registros removidos por padrão.
- Registro removido permanece para auditoria.
- Restauração é possível.
- Registro removido permanece sob a política de ownership/RLS.

## RLS

- RLS habilitado em toda tabela.
- Ausência de política significa negação.
- Dados de usuário: política por identidade autenticada.
- Catálogo compartilhado: leitura para autenticados, escrita restrita.
- Tabelas de sistema: sem política de cliente, acesso por função definer.
- RLS é a fonte da verdade de permissões.

## EVENTS

- Eventos de negócio são registrados de forma conceitual.
- Eventos são imutáveis após registro.
- Nomenclatura em tempo passado (Created, Updated, Completed, Cancelled).
- Sem infraestrutura de event bus obrigatória no MVP.
- Eventos alimentam integrações e analíticas no futuro.

## INDEXES

- Indexar chaves primárias e estrangeiras.
- Indexar colunas de filtro e ordenação frequentes.
- Usar índices parciais para filtros comuns.
- Usar índice vetorial (HNSW) para colunas de embedding.
- Evitar indexação excessiva sem padrão de acesso.
- Revisar índices com dados de produção.

## PERFORMANCE

- Consultas seguem padrões de acesso antes de criar índices.
- Evitar N+1; preferir consultas em lote.
- Listagens usam paginação e limites.
- Campos pesados (texto longo, vetores) em colunas adequadas.
- Monitorar consultas lentas e ajustar.

## SECURITY

- Nenhum segredo acessível pelo cliente.
- Acesso administrativo restrito ao servidor.
- Dados sensíveis criptografados quando necessário.
- Ações administrativas auditadas.
- Princípio do menor privilégio.
- Validação de entrada em todas as fronteiras.

## FUTURE EXTENSIONS

- Nova entidade segue este padrão e as decisões de domínio.
- Registro da entidade no modelo de domínio antes da criação física.
- Respeitar shared kernel e anti-corruption layers.
- Atualizar documentação afetada.
- Validar ownership, RLS e soft delete antes de criar.

---

# ENTITY CHECKLIST

> Checklist obrigatório para criação de qualquer nova entidade.

- [ ] Nome da tabela em plural snake_case.
- [ ] Identificador UUID definido.
- [ ] Campos de auditoria (created_at, updated_at) presentes.
- [ ] Política de soft delete definida.
- [ ] Ownership definido (usuário, catálogo ou sistema).
- [ ] Políticas RLS criadas (negação por padrão).
- [ ] Chaves estrangeiras nomeadas conforme padrão.
- [ ] Constraints (unicidade, check) definidas.
- [ ] Estados de ciclo de vida definidos.
- [ ] Eventos de negócio registrados.
- [ ] Índices definidos conforme padrão de acesso.
- [ ] Nomenclatura segue o padrão oficial.
- [ ] Entidade registrada no modelo de domínio.
- [ ] Documentação afetada atualizada.
- [ ] Decisões abertas relevantes revisadas.
