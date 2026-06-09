---
name: allegrolang-org-dev-loop
description: allegrolang.org (S3+CloudFront) is updated alongside features; user uses it as a sandbox, not just a public marketing site
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
allegrolang.org is hosted on AWS S3 with a CloudFront distribution. `deploy.sh` does sync + CloudFront invalidation. Files live under `website/`.

**Why:** The user uses the site as their primary sandbox to explore and play with examples — not just a public-facing artifact. Features that don't make it to the website don't get exercised by the user as much. Updates also matter for prospective users (especially given the AI-velocity argument for provability — see `design_provability_thesis.md`).

**How to apply:**
- When a feature lands, update the website in the same cycle. Add a sandbox example demonstrating it.
- New grammar libraries must be registered via `Allegro.registerLibrary` in the web bundle (a "Grammar library 'X' not registered" error in the sandbox means this was forgotten).
- Run `./deploy.sh` to sync and invalidate. Note the CloudFront invalidation ID in commit messages where relevant.
- **Lead with provability/safety** on the site. The user explicitly said "Don't bury the lede on provability!" The hero example should demonstrate provability combined with other features.
- Web sandbox supports streaming output for async demos, an Inspect button per demo (renders the introspection summary with a coloured grade badge), and named snippet save/load via localStorage.
