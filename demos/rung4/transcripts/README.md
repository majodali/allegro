# Rung 4 transcripts

This folder holds the planning loop's transcripts: each Markdown file
records one run of `allegro prove` turn by turn (the request, the reply's
code block, the kernel's answer and the time each took), with a JSON twin
of the same name beside it. A transcript is made by `npx tsx src/index.ts
prove FILE --transcript demos/rung4/transcripts/NAME.md`, with
`--proposals demos/rung4/transcripts/proposals.md` for the scripted
proposer, as `scripted-planning-loop-proposals.md` was, or with a
language model. The keyed run, on the maintainer's machine where Claude
Code is logged in with the subscription, is `npx tsx src/index.ts prove
tests/planning-loop-proposals.alg --proposer claude-code --transcript
demos/rung4/transcripts/llm-planning-loop-proposals.md --json`.
