#!/bin/sh
# Stand-in for `claude -p` when testing `kata generate`: ignores the prompt and
# writes one good and one vacuous challenge into the current directory.
here="$(cd "$(dirname "$0")" && pwd)"
cp -R "$here/../fixtures/generate/gen-health-check" ./gen-health-check
cp -R "$here/../fixtures/generate/gen-vacuous" ./gen-vacuous
echo "fake-claude: wrote 2 challenges"
