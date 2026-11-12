# Rung 4 transcripts

This folder holds the planning loop's transcripts: each Markdown file
records one run of `allegro prove` turn by turn (the request, the reply's
code block, the kernel's answer and the time each took), with a JSON twin
of the same name beside it. A transcript is made by `npx tsx src/index.ts
prove FILE --transcript demos/rung4/transcripts/NAME.md`, with
`--proposals FILE.md` for the scripted proposer, or with a language
model.

- `01-loop-scripted.md` and `.json`: the scripted loop on scene 1,
  written by `npx tsx src/index.ts prove demos/rung4/01-loop.alg
  --proposals demos/rung4/transcripts/01-loop-proposals.md --transcript
  demos/rung4/transcripts/01-loop-scripted.md --json`. A test runs it
  again and compares every field but the date and the times.
- `scripted-planning-loop-proposals.md` and `.json`: the scripted loop on
  `tests/planning-loop-proposals.alg`, with `proposals.md`.
- `llm-planning-loop-proposals.md` and `.json`: the keyed run, on the
  maintainer's machine where Claude Code is logged in with the
  subscription: `npx tsx src/index.ts prove
  tests/planning-loop-proposals.alg --proposer claude-code --transcript
  demos/rung4/transcripts/llm-planning-loop-proposals.md --json`. It
  predates chunk L7, whose `prove` skips a theorem the file does not
  declare before any request, so it records one request about each of
  the units library's five laws; it is the record of that run. A test
  puts each of its replies for `Fulfil` through the kernel again and
  compares the answer with the one recorded.
- `01-halt.txt`: scene 1's break-it halt.
