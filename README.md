# PAF: Detector de Fraude em Propostas

Ferramenta que recebe uma planilha de propostas de crédito e encontra **endereços repetidos entre clientes diferentes**, um indício comum de fraude. Os grupos suspeitos aparecem coloridos na tela e podem ser baixados para a análise de risco.

**Demonstração:** https://anirutsolrak.github.io/Projeto-PAF/ (dados fictícios, roda no navegador, sem servidor)

## Como funciona

1. A planilha `.xlsx` sobe para a API em Flask.
2. As colunas são reconhecidas por nome, com variações (`logradouro`, `endereco`, `rua`...).
3. Cada endereço é normalizado: sem acento, minúsculo e com abreviações unificadas (`Rua` → `r`, `Apartamento`/`Apto`/`Ap.` → `ap`, `São` → `s`, `nº` some...). Assim `Rua das Acácias, 220, Apto 12` e `R. das Acacias, 220, Ap. 12` viram o mesmo endereço.
4. Endereços idênticos depois da normalização formam um grupo. Cada grupo ganha uma cor.
5. O resultado completo é exportado em `.xlsx`.

## Estrutura

```
backend/    API Flask + análise em pandas (analysis.py) + testes (pytest)
frontend/   React + TypeScript + Vite + Tailwind
  src/demo/ mesma análise em TypeScript e as propostas fictícias do modo demo
Dockerfile  build do front + Flask servindo tudo na porta 5001
```

A análise existe em Python (produção) e em TypeScript (demo). Os dois lados são testados contra o **mesmo** arquivo de propostas fictícias (`frontend/src/demo/propostas-exemplo.json`), então qualquer divergência quebra o CI.

## Rodando

Com Docker:

```bash
docker compose up --build   # http://localhost:5001
```

Sem Docker:

```bash
cd backend && pip install -r requirements.txt && python app.py   # API na 5001
cd frontend && npm install && npm run dev                         # http://localhost:8080 (proxy para a API)
```

Planilha para testar: `frontend/public/propostas-exemplo.xlsx`. O sistema lê o **cabeçalho na 2ª linha**, como no relatório de origem.

Modo demo local: `cd frontend && npm run build:demo && npx vite preview`.

## Testes

```bash
cd backend && python -m pytest -q
cd frontend && npm test
```

## Limites conhecidos

- Os resultados aguardando download ficam na memória do processo (os 20 mais recentes). Isso funciona com um worker só.
- A comparação é por igualdade depois da normalização. Erros de digitação no nome da rua (`Acácias` × `Acacas`) não são agrupados.
- Na demo, o download sai em CSV para não carregar uma biblioteca de Excel no navegador.
