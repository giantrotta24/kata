# Bad fixture: passes once, fails on a rerun

Implement `add(a, b)` in `starter/math.ts`. One test leaks state into the checkout it runs in, so it passes on a clean run and fails when the same code is run again. Validation must reject this at check 3.

A test that fails at random would also be flaky, but two runs can't catch it reliably (a 50% flake slips through two runs a quarter of the time), so this fixture uses a deterministic flake.
