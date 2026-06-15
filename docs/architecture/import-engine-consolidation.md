# Import Engine Consolidation

## Objetivo

Esta consolidacao reduz o acoplamento da Import Engine sem alterar as regras de
negocio validadas da Importacao de Pecas v1.

O trabalho e incremental. O fluxo oficial continua usando `PartCanonical`,
`buildPersistencePayload`, `buildUpdatePatch` e os adapters atuais. A primeira
etapa cria contratos de dominio que podem ser adotados gradualmente.

## Separacao de camadas

A direcao arquitetural desejada e:

```text
src/domain
src/application
src/ports
src/adapters
src/app
```

Responsabilidades:

- `domain`: entidades, tipos, validacoes e regras independentes de tecnologia;
- `application`: casos de uso e coordenacao de fluxos;
- `ports`: interfaces exigidas pelos casos de uso;
- `adapters`: implementacoes de banco, APIs e servicos externos;
- `app`: UI, rotas e composicao das dependencias.

Regras de dependencia:

- domain nao importa adapters;
- application pode usar domain e ports;
- adapters implementam ports;
- UI chama application ou services;
- adapters nao decidem regra de negocio.

Nem todos os arquivos precisam ser movidos imediatamente. Movimentacoes devem
ocorrer quando houver cobertura e baixo risco de regressao.

## CanonicalPart

`CanonicalPart` e o modelo oficial de dominio da peca. Ele representa
identidade, dados comerciais, organizacao, conteudo, vinculos de marketplace,
imagens, veiculo, categoria, dimensoes e metadata sem reproduzir o schema de um
banco especifico.

O dominio nao conhece tabelas Supabase, documentos Mongo, entidades Symfony ou
payloads de APIs externas. Essas representacoes sao shapes de persistencia e
devem ser produzidas por mappers de borda.

Nesta etapa:

- `fromPartCanonical` cria a ponte do normalizador atual para o dominio;
- `validateCanonicalPart` valida invariantes minimas em runtime;
- `toSupabaseInventoryShape` documenta o shape atual de `inventory_items`;
- `toMongoInventoryShape` documenta o shape historico do Mongo.

Nenhum mapper de saida foi conectado a persistencia nesta sprint.

## IntegrationId e contexto operacional

`CanonicalPart` nao exige um `integrationId`. Um vinculo de marketplace pode
conter esse identificador quando a origem o conhece, mas a identidade da peca
nao depende dele.

`ImportExecutionContext` representa a operacao atual e conhece:

- `integrationId`;
- `storeId`;
- canal;
- credenciais e usuario do marketplace quando disponiveis.

Essa separacao evita transformar contexto transitorio de execucao em requisito
permanente do dominio.

Ao mapear integracoes:

- um `integrationId` existente e usado como chave;
- sem `integrationId`, a chave de fallback e
  `${marketplace}:${marketplaceId}`.

O mapper nao inventa um identificador de integracao.

## Papel dos adapters

Adapters traduzem contratos e executam IO. Eles podem:

- carregar e persistir inventario;
- consultar APIs externas;
- gravar historico;
- registrar snapshots de anuncios.

Adapters nao devem:

- decidir se uma peca e valida;
- escolher create, update, skip ou conflict;
- resolver prioridade de imagens;
- definir regra de vinculo de anuncio;
- alterar regra comercial.

Essas decisoes pertencem ao dominio ou aos casos de uso da application.

## Plano incremental

1. Manter o fluxo oficial inalterado e criar pontes para `CanonicalPart`.
2. Validar mappers e invariantes na pagina tecnica.
3. Criar ports explicitos para inventario, historico e marketplace.
4. Extrair coordenacao de UI para casos de uso em `application`.
5. Migrar regras isoladas para domain sem mudar resultados.
6. Adotar `CanonicalPart` internamente apenas com testes de equivalencia.
7. Conectar mappers de persistencia depois de validar compatibilidade.
8. Remover contratos legados somente quando nao houver consumidores.

## Fora de escopo

Esta etapa nao implementa Mongo, Symfony, FTP, rollback, fila, retry ou novas
regras da Importacao de Pecas. Tambem nao altera AdLink, ImagePlan, historico ou
a tela oficial `/importacoes/pecas`.
