# Kata

A daily coding challenge in the terminal. You get one challenge a day, solve it by hand with AI off, and hidden tests grade it in Docker. Streaks, XP and per-track levels keep score.

Three tracks: **ts-frontend** (React + Testing Library), **ts-backend** (Node HTTP) and **sql** (Postgres). Three challenge types: **build**, **debug** and **extend**.

## Setup

Needs Node 24 and Docker.

```sh
npm install
npm run build
npm link              # puts `kata` on your PATH
docker compose build  # the grading image
```

### The AI-off editor profile (one-time, manual)

`kata today` opens the workspace with `cursor --profile Kata`. Create that profile in Cursor once, then in it:

1. Turn off Cursor Tab (autocomplete).
2. Hide the chat and agent panes.
3. Install only language support, ESLint and a Postgres client.

Kata never touches Cursor's settings.

### The reminder

Add this line to `~/.zshrc` yourself (Kata never edits shell config):

```sh
command -v kata >/dev/null && kata nudge
```

It prints "Today's kata isn't done" until today's daily passes, and nothing otherwise. It never touches Docker or the network.

## Daily loop

```sh
kata today      # pick today's challenge, make a workspace, open the editor
kata submit     # grade the workspace in Docker
kata status     # streak, freezes, XP, levels, today
```

Edit the files in the workspace's `starter/` folder. The README there is the spec.

| Command | What it does |
|---|---|
| `kata today [--no-open]` | Today's daily. Same challenge and workspace all day. An unfinished daily carries over. |
| `kata submit [--assisted]` | Grades the current challenge. `--assisted` keeps the streak but earns no XP or level credit. |
| `kata hint` | Next of three hints. Each costs 25% of the XP. |
| `kata reroll` | Once a day: swap the daily for another on the same track and level. Counts as a rough outcome. |
| `kata flag [--yes]` | The challenge is broken: removes it from the bank and refunds the day. Run it from the challenge's workspace, or pass `--yes` to flag the current challenge from anywhere. |
| `kata next [--track] [--level]` | An extra challenge. Full XP; doesn't count for the streak. |
| `kata import <dirs...>` | Validate challenge folders that include `solution/` and admit those that pass. |
| `kata generate [--count N] [--track] [--level] [--type]` | Generate challenges with `claude -p`, validate them, admit what passes. |
| `kata nudge` | The shell reminder. |

"Current challenge" is the one whose workspace you're in, or else today's unfinished daily, or else the most recently started unfinished one.

## Scoring

- XP only when every test passes. Base XP by level: 10, 20, 40, 70, 100.
- Each failed submit before the pass: ×0.9, never below ×0.5 in total. Passing on the first submit: ×1.2.
- Each hint: ×0.75. Rounded down.
- Example: level 3, 2 failed submits, 1 hint → 40 × 0.9 × 0.9 × 0.75 = 24.

## Levels

Each track starts at level 2. Three clean solves (at most one failed submit, no hints) move it up; two rough outcomes (a reroll, or a pass with 2+ hints) move it down. Both counters reset on every level change. The daily matches your level, leans toward your weakest and most neglected track, and is one level higher about one day in five.

## Streak

A day runs 03:00 to 03:00. It counts when that day's daily passes. You start with 2 freezes, earn 1 per 7 consecutive counted days, and hold at most 3; a missed day uses one automatically, and with none left the streak resets.

## Files

Everything lives in `~/.kata`, or `$KATA_HOME`, or `--home <dir>` (the flag wins):

- `bank/<id>/`: admitted challenges (`README.md`, `meta.json`, `starter/`, `tests/`, `hints.md`). Solutions are deleted on admission. Don't open it.
- `kata.db`: SQLite scores.
- `staging/`, `runs/`: scratch space for validation and grading.
- `config.json` (optional):

```json
{
  "workspaceDir": "~/kata",
  "editorCommand": "cursor --profile Kata",
  "claudeBin": "claude"
}
```

Relative paths in `config.json` resolve against the home folder. Workspaces are created at `<workspaceDir>/<date>-<id>/`.

## Writing challenges

A challenge folder has `meta.json`, `README.md`, `hints.md` (three `## ` sections: nudge, approach, near-answer), `starter/`, `tests/` and `solution/`. See `fixtures/good/` for one of each track, and `prompts/generate.md` for the full contract.

- Tests import the solver's code from `../src/`.
- `solution/` holds only the files that change; the reference is `starter/` with `solution/` laid over it.
- SQL challenges put schema and data in `tests/seed.sql`; each run gets a fresh database.
- `extend` challenges list their pre-existing suite in `meta.json` `existingTests`.

A challenge is admitted only if the reference passes every test, the untouched starter fails at least one, the reference passes a second run, and (for `extend`) the starter passes the existing suite. Rejections name the failed check.

A run that doesn't finish within 120 s is killed and counts as a failure: a timed-out submit is recorded as a failed submit, and a timed-out validation rejects the challenge.
