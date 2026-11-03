# Full Natively v3 evaluation

Branch: `integration/natively-full-v3`
Source commit: `ccd3540683b6010f632428350cf06f777972692f` (Natively `main`, 2026-11-02)
Upstream release: `v3.0.0` (2026-11-01)
Stable AnswerCue `main`: unchanged at v2.8.12.

## What this branch is

This branch is a direct source snapshot of the latest public Natively repository. It is intentionally separate from both the stable AnswerCue branch and `integration/natively-v3-preview`, which selectively ports compatible features while preserving AnswerCue behavior.

The GitHub repository remains `devasheeshG/AnswerCue`. Changing its GitHub fork parent is unnecessary and would make the stable history and release relationship harder to manage. The local `natively` remote tracks Natively's public source and has no push URL.

## Full feature scope

The snapshot includes Natively's current public v3 application: meeting notepad and recipes, overlay custom buttons, connectors and auto-send flows, shareable notes, follow-up email composition, MCP/API surfaces, web search, browser/page capture, broader speech/local-model options, meeting-app integrations, attendee details, profile intelligence, role insight, modes/skills, calendar integrations, room-speaker handling, and Natively's current notes and answer engine.

It also includes two Git submodules:

- `premium` at `e50c08d0b58a7d11742df54591b95af21f27c0be` (`natively-premium.git`)
- `natively-api` at `ad9e1f20a7d8bdbaa32066aea604af7e941a05a8` (`natively-api.git`)

Those repositories return HTTP 404 for this checkout/account. They are not present locally, so full premium/provider-company-search builds cannot be reproduced here.

## Verification performed

- `npm ci --ignore-scripts` completed on Node 22.23.1.
- Renderer production build passed; Vite completed successfully.
- TypeScript 7 Electron check passed with zero diagnostics.
- Core Electron bundle passed when run with `NATIVELY_CORE_SMOKE=1`, which externalizes unavailable premium imports.
- Core smoke suite passed: **219 tests, 0 failed, 0 skipped** across 16 suites.
- Initial smoke failures were caused by a corrupted/incomplete Electron binary after overlapping local install attempts. Rebuilding Electron with `npm rebuild electron` fixed the environment; the rerun passed.
- A normal full Electron bundle cannot resolve three premium imports without the private submodule: `TavilySearchProvider`, `NativelySearchProvider`, and premium `knowledge/types`.
- The full release/test workflow requires a `SUBMODULE_TOKEN` or `GH_APP_TOKEN` to fetch `premium`; the fork-safe workflow intentionally runs only its core scope when that secret is unavailable.

## What is not claimed

This branch has not been released or merged into `main`. No full packaged installer is claimed from this checkout. Premium company-search, connector-service authentication, hosted sharing, MCP/API service behavior, live provider calls, local model downloads, microphone/system audio, and native Mac window behavior need their required private repositories, service credentials, and installed-device checks.

The full upstream branch also does not preserve every AnswerCue-only change. In particular, it does not contain AnswerCue's chat forks/message-context deletion, cloud-only/no-local-model packaging decisions, OpenAI response-tier UI, AnswerCue preview-profile isolation, or the AnswerCue-specific Dock identity fixes. That is why it must remain an evaluation branch until a deliberate reconciliation is designed.

## Recommendation

Keep this branch for evaluating Natively's complete product direction. Keep `integration/natively-v3-preview` for selective feature testing. Do not replace AnswerCue `main` with this branch until the private submodules are available, native/provider acceptance checks pass, and the AnswerCue-only features have been ported or explicitly accepted as removed.
