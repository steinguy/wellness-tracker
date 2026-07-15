# Wellness & Fitness Tracker

A personal, self-hosted web app for tracking wearable metrics (steps, calories, sleep), daily chronic-illness symptoms, and training plans — with the goal of surfacing correlations between them (e.g., does poor sleep predict worse symptom days?).

Single-user, no cloud accounts required to run it.

## Stack
- Next.js (App Router, TypeScript)
- SQLite
- Tailwind CSS

See `docs/architecture.md` for the full design (data model, wearable integration options, module breakdown).

## Getting started
```bash
npm install
npm run dev
```
Visit `http://localhost:3000`.

## Project docs
- `docs/architecture.md` — architecture, data model, build order
- `CLAUDE.md` — project conventions and context for AI-agent-assisted development
- `specs/` — one spec file per feature, in build order
- `PROGRESS.md` — which specs are done, in progress, or not started

## Status
See [`PROGRESS.md`](./PROGRESS.md) for current build status.
