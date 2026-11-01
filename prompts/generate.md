You are writing coding challenges for Kata, a daily practice tool. A developer solves one challenge a day by hand, with no AI help, and hidden tests grade the result. Write challenges that resemble everyday full-stack work, not puzzle trivia.

## Task

Write {{count}} new challenge folder(s) in the current directory, one folder per challenge, named after the challenge id.

- Track: {{track}}
- Level: {{level}}
- Type: {{type}}
- Ids already in the bank, do not reuse: {{existingIds}}

Write files only. Do not run anything.

## Folder layout

```
<id>/
  meta.json
  README.md
  hints.md
  starter/      code the solver starts from (copied to their workspace)
  solution/     reference solution files, laid over starter/ (deleted after validation)
  tests/        hidden tests; never shown to the solver
```

`solution/` contains only files that differ from or are added to `starter/`, at the same relative paths. The reference solution is `starter/` with `solution/` copied on top.

## meta.json

```json
{
  "id": "kebab-case-id",
  "title": "Short human title",
  "track": "ts-frontend | ts-backend | sql",
  "type": "build | debug | extend",
  "level": 1,
  "estimateMinutes": 20,
  "concepts": ["tag", "tag"],
  "existingTests": ["tests/existing.test.ts"]
}
```

`existingTests` is required for `extend` and omitted otherwise. It lists the test files that make up the pre-existing suite.

## Levels

1. A single small function or component, one concept, about 10 minutes.
2. A few moving parts, about 20 minutes.
3. Several concepts together, edge cases matter, about 30 minutes.
4. Non-trivial design, state or query logic, about 45 minutes.
5. Hard: subtle correctness, performance or concurrency, about 60 minutes.

## Types

- **build**: the starter is a skeleton with types and empty bodies. The README is a clear spec.
- **debug**: the starter is working code with exactly one planted bug. The README is a vague, ticket-style bug report written by a non-engineer; it describes a symptom, not the cause. At least one test fails because of the bug.
- **extend**: the starter is a small working codebase whose `existingTests` pass. The README asks for one new feature. New tests cover the feature; the existing tests must keep passing.

## Tracks and test environment

Tests run with Vitest 3 inside a Docker container with no network access. Test files live in `tests/` and import the solver's code from `../src/` (the starter is mounted at `src/`). Name test files `*.test.ts` or `*.test.tsx`. Import `describe`, `it`, `expect` and hooks from `vitest`. Available packages: react 18, react-dom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom (matchers preloaded for ts-frontend), msw 2, pg, jsdom.

- **ts-frontend**: React function components in `.tsx`, tested in jsdom with Testing Library. Find elements only by role, label or visible text. Never assert styling, class names or CSS. Mock network calls with `msw/node` `setupServer` against absolute URLs such as `https://api.kata.test/...`, with `onUnhandledRequest: 'error'`.
- **ts-backend**: Node HTTP code using `node:http`. Export a factory such as `createApp()` that returns an `http.Server`. Tests start it with `listen(0, '127.0.0.1')`, send real requests with `fetch`, and close it with `closeAllConnections()` then `close()` after each test.
- **sql**: Postgres 17. Put the schema and seed data in `tests/seed.sql`; each run gets a fresh database seeded from it. The solver writes `.sql` files in the starter. Tests read the file from `../src/`, run it with `new pg.Client()` (connection settings come from the environment) and compare rows. Decide per test whether row order matters: if not, sort both sides before comparing. Cast dates and numerics to text or int in the expected output columns and say so in the README, since `pg` returns them as Date objects or strings. Describe the schema in the README, because the solver never sees `tests/`.

## Requirements

- The reference solution must pass every test, twice in a row, with no randomness, timing dependence or shared state between runs.
- The untouched starter must fail at least one test.
- For `extend`, the untouched starter must pass every test in `existingTests`.
- Tests check behaviour through the public interface described in the README, not implementation details. Give failing assertions useful messages.
- The README states everything the solver needs: file names, exported names, inputs, outputs and edge cases. It never reveals the solution.
- `hints.md` has exactly three sections, each starting with `## Hint N`: 1 is a nudge, 2 is an approach, 3 is nearly the answer.
- Plain TypeScript, no extra dependencies, no `any` in starter code.

Challenges that break any requirement are rejected automatically.
