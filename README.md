# Asaas Pay by Thoth24 — Conector Bitrix24

Integração oficial entre **Bitrix24** e **Asaas** para automatizar cobranças via PIX, Boleto e Cartão, assinaturas recorrentes, emissão de NFSe e automações de CRM/Bizproc.

- Site: https://asaas.thoth24.com
- Suporte: contato@thoth24.com

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Edge Functions, Storage)
- Bitrix24 REST + Placements + Bizproc + Pay System API

## Rodando localmente

Pré-requisito: Node.js 18+ e npm.

```sh
npm install
npm run dev
```

A aplicação sobe em `http://localhost:8080`.

## Deploy

O frontend é publicado em `https://asaas.thoth24.com`. As Edge Functions ficam no projeto Supabase associado (deploy automático via CI).

## Licença

© Thoth24. Todos os direitos reservados.
