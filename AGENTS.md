# AGENTS.md

Kata: a local daily coding challenge CLI. TypeScript on Node 24, `commander`, `better-sqlite3`, Vitest. Hidden tests run in Docker.

## Commands

```sh
npm run typecheck   # tsc over src/ and test/
npm test            # Kata's own unit tests (no Docker)
npm run build       # compiles to dist/; the CLI is dist/cli.js
docker compose build
node dist/cli.js --home ./.kata-dev <command>
```

## The KATA_HOME rule

Never read or write the real `~/.kata`. All dev and test state goes in `./.kata-dev/` (gitignored), passed with the global `--home ./.kata-dev` flag. Unit tests use `./.test-tmp/`. Don't edit `~/.zshrc` or Cursor's settings; the README documents both as manual steps. The shell reminder line is:

```sh
command -v kata >/dev/null && kata nudge
```

## Layout

- `src/cli.ts`: command wiring. `src/kata.ts`: the service behind every command.
- Pure logic, unit-tested: `scoring.ts` (XP, levels), `streak.ts` (freezes), `day.ts` (03:00 boundary), `pick.ts` (seeded daily pick).
- `src/runner.ts`: runs a suite in the `runner` compose service and parses Vitest's JSON report. `src/validate.ts`: the four admission checks.
- `runner/`: the grading image (Vitest, React, Testing Library, jsdom, MSW, pg). `run.mjs` creates and seeds a fresh Postgres database for sql runs.
- `docker-compose.yml`: `runner` and `postgres` on an internal network with no route out.
- `prompts/generate.md`: the `kata generate` prompt (LLM-facing).
- `fixtures/good/`, `fixtures/bad/`: challenges with solutions for tests and end-to-end checks. `fixtures/generate/` plus `scripts/fake-claude.sh` stand in for `claude -p`.

## Conventions

- Inside the container, the solver's code is mounted at `/opt/runner/work/src` and tests at `work/tests` (read-only); tests import from `../src/`.
- A challenge's reference is `starter/` with `solution/` laid over it.
- Keep `nudge` free of Docker, network and writes; it runs on every shell start.
