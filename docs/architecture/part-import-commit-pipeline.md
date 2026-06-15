# Part Import Commit Pipeline

Este documento formaliza o pipeline oficial da tela `/importacoes/pecas`.

## Executor oficial

O commit da tela de importacao de pecas usa
`executePartImportWithComplements`. O executor cria um unico `import_run` e,
nesse mesmo run, coordena:

1. persistencia da peca;
2. resolucao e registro do vinculo de anuncio, quando houver MLB;
3. construcao do `imagePlan`;
4. persistencia do resultado por linha em `import_run_items`.

`executeImportWithHistory` e um fluxo legado sem complementos. Ele pode
continuar atendendo ferramentas tecnicas, mas nao e usado pela tela oficial de
pecas.

## Diagrama

```text
Dry Run:
parse -> normalize -> validate -> match -> compare -> executionPlan

Commit:
executionPlan
-> persist part
-> resolve ad link
-> execute ad link registry
-> build image plan
-> save import_run_items
```

## Contrato por linha

Cada item salvo em `import_run_items` inclui no `payload`:

```ts
{
  partResult,
  adLinkResult,
  imagePlan
}
```

Os tres campos sao sempre gravados como objetos. Etapas nao aplicaveis usam
resultado explicito com `action: "skipped"`; nao usam ausencia de campo ou
`null`.

## Regras preservadas

- A peca e a entidade principal.
- MLB invalido nao bloqueia a persistencia da peca.
- Imagem ausente gera `imagePlan.action = "no_image"` e nao bloqueia a peca.
- Anuncio valido e inserido ou atualizado em `marketplace_ads`.
- Anuncio invalido gera pendencia complementar.
- O `imagePlan` e apenas descritivo: nao baixa nem persiste imagem real.
- O pipeline nao cria sincronizacao com o Mercado Livre.

## Resumo final

O resultado do commit e o resumo salvo no `import_run` incluem:

- `Created`;
- `Updated`;
- `Skipped`;
- `Failed`;
- `Pending`;
- `Complement Pending`;
- `Anuncios vinculados`;
- `Anuncios pendentes`;
- `Anuncios com erro`;
- `Imagens ML`;
- `Imagens planilha`;
- `Sem imagem`.

`Pending` representa conflitos, linhas invalidas e falhas da peca.
`Complement Pending` representa pendencias de anuncio ou imagem e nao altera o
resultado principal da peca.
