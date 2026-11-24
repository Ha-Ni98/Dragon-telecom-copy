# Dragon Telecom

A store management system for a phone spare-parts and repair shop in Algeria. It runs both the **online storefront** and the **in-store point of sale**, with one inventory, one set of client accounts and one set of books behind them.

**Live:** [dragon.gs](https://dragon.gs)

> This repository is a portfolio copy of the production codebase. The production repository is private and is the one deployed to dragon.gs. This copy is kept in sync for review purposes.

## What it does

**Storefront (public)**
- Product catalogue organised by device brand, model and part family, with search and product pages
- Client registration, reviewed and approved by staff before an account is active
- Online orders with delivery or store pickup, and delivery fees resolved by wilaya and commune
- Repair requests that the client can follow

**Staff and admin**
- **Point of sale:** draft and confirm in-store sales, returns, and receipts printed at 80 mm
- **Inventory:** FIFO cost layers, so every sale records its exact cost of goods and profit
- **Purchasing:** suppliers, supplier invoices (goods receipt) and supplier payments
- **Orders and repairs:** per-type status machines, with stock reserved while work is open and consumed at completion or pickup
- **Billing:** invoices, client payments, and a payment ledger that is never edited or deleted
- **Statistics:** dashboards, reports and a cash-register view for staff
- **Audit trail:** every mutation is recorded with its before and after values
- **Labels and barcodes:** Code 128 barcodes and printable product labels
- **Role-based access:** pages are granted per staff role and data is scoped to the signed-in user; admins see everything

## Engineering highlights

- **Contract-first monorepo.** A shared `contract` package holds every schema, DTO, route constant, enum, error code and event type. The API and the web app both depend on it and never on each other.
- **Zod 4 end to end.** Types are inferred from schemas, so the request validation, the API and the forms share one source of truth.
- **Modular backend with manual dependency injection.** Each module has at most six files: interface, mapper, service, listener, controller and routes. Modules talk through injected ports and domain events, never by importing each other.
- **Money and stock integrity.** Cost caches are written inside the owning transaction on a row locked with `SELECT … FOR UPDATE`. Event listeners never write financial caches, which avoids race conditions under sequential use.
- **Documented invariants.** The FIFO arithmetic, the average-cost rules, the payment ledger and the recognition timing for sales, orders and repairs are written down in `docs/` and enforced in code.
- **Role-shaped DTOs.** Cost and margin data are removed in the mapper for staff-facing responses, not hidden in the UI.
- **Frontend layering.** `component → hook (TanStack Query) → service → API`, with React Hook Form using the contract schemas directly, and full light and dark theming.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, TanStack Query, React Hook Form, shadcn/ui, Tailwind CSS, i18next-style `t()` translation |
| Backend | Node.js, Express 5, Prisma, PostgreSQL, TypeScript |
| Shared | Zod 4 contract package |
| Media | Sharp pipeline (validate, strip metadata, resize, convert to WebP) and Cloudflare R2 storage |
| Deployment | Fly.io (API), static hosting for the web app, external managed PostgreSQL |

## Repository layout

```
Apps/
  contract/   shared schemas, DTOs, routes, enums, error codes, event types
  api/        Express API, Prisma schema and migrations
  web/        React single-page application
docs/         architecture, domain invariants, layer rules, decision record
```

## Running it locally

Prerequisites: Node.js, npm and a PostgreSQL database.

```bash
# 1. Install dependencies in each app
cd Apps/contract && npm install
cd ../api && npm install
cd ../web && npm install

# 2. Configure the API (see the environment variables below)
cp Apps/api/.env.example Apps/api/.env

# 3. Create the database schema
cd Apps/api && npx prisma migrate dev

# 4. Start the API and the web app in two terminals
cd Apps/api && npm run dev
cd Apps/web && npm run dev
```

> Replace these commands with the exact ones from the project's package scripts if they differ.

### Environment variables

The API needs at least:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | signing key for access tokens |
| `R2_*` | Cloudflare R2 credentials for uploaded images |

Secrets are never committed. Use a local `.env` file, which is git-ignored.

## Documentation

The `docs/` folder explains how the system is built and why:

- `architecture.md`: modules, events, access model and glossary
- `domain-invariants.md`: the money and stock rules
- `decisions.md`: the decision record, with what each decision forbids
- `backend-rules.md`, `frontend-rules.md`, `contract-rules.md`: layer conventions

## Scope

This is deliberately a single-store system. It supports one store and one tenant, cash payments only, French and English, and no promotions or discounts. Each of these is a recorded decision, not a missing feature.

## Author

Built by me ;) with the help of claude code ofc as a freelance project for a phone spare-parts business. 
