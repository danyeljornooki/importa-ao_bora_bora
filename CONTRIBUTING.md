# Guia de colaboracao

Este projeto vai ser mantido por mais de uma pessoa. Usem este fluxo para evitar conflito, sobrescrever trabalho dos outros ou quebrar a `main`.

## Fluxo recomendado

1. Antes de comecar, atualize sua maquina:

```bash
git switch main
git pull --ff-only
```

2. Crie uma branch para cada tarefa:

```bash
git switch -c seu-nome/descricao-curta
```

Exemplos:

```bash
git switch -c danyel/tela-login
git switch -c israel/ajuste-importacao
```

3. Instale as dependencias usando o lockfile:

```bash
npm ci
```

4. Antes de subir, rode as verificacoes:

```bash
npm test
npm run build
```

5. Salve e envie sua branch:

```bash
git status
git add .
git commit -m "descreva a mudanca"
git push -u origin sua-branch
```

6. Abra um Pull Request no GitHub para revisar e juntar na `main`.

## Regras simples

- Nao trabalhe direto na `main`.
- Nao use `git push --force` na `main`.
- Sempre faca `git pull --ff-only` antes de criar uma branch nova.
- Combine com a outra pessoa antes de mexer no mesmo arquivo grande.
- Arquivos `.env` ficam fora do Git. Compartilhem as chaves por outro canal seguro.
- `package-lock.json` deve ser commitado quando `package.json` mudar.

## Quando der conflito

Atualize sua branch com a `main`:

```bash
git fetch origin
git merge origin/main
```

Resolva os arquivos marcados pelo Git, rode os testes e finalize:

```bash
git add .
git commit
npm test
```

Se o conflito parecer estranho, parem e conversem antes de apagar codigo.
