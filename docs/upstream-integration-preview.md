# Upstream integration preview

Branch: `integration/natively-v3-preview`. Stable `main` remains unchanged.
Upstream audited: Natively `ccd3540683b6010f632428350cf06f777972692f` (2026-11-02).
Base: AnswerCue v2.8.12 plus its macOS runner migration.

## Integration decision

This is a selective, compatible integration rather than a full v3 product replacement. The trial full merge conflicted across the core app, prompts, audio, packaging, and branding and would reintroduce local-model and indexing infrastructure deliberately removed from this fork. The trial merge was aborted; no unresolved merge or hidden wholesale import remains.

The reusable web-search and custom-action modules were ported from upstream under the repository's existing AGPL license. Their integrations use AnswerCue's current chat, provider and context paths. The upstream Natively subscription search service is not used.

## Included

- Typed-chat web search using a user-supplied Tavily key, configured under AI Providers → Preview features → Tavily Search. An explicit search request in stopped interview chat uses up to five results with citations. Scoped interview chat does not automatically search just because the user says “today”. Live interview turns and spoken answers never wait for web search. Only the search query is sent to Tavily, not the full transcript, documents or API-provider keys. Removing the search key disables search.
- Up to four named custom overlay actions, with persisted plain-language instructions. Actions run through the existing typed-chat request path with the selected provider and existing context/preferences. The full upstream generated-contract/screenshot/action-reordering UI is intentionally not included in this first preview.
- ElevenLabs recoverable session-error handling and healthy-session reconnect-budget reset, adapted to the existing cloud-only transport. Credit, authentication, terms and invalid-request errors remain terminal; vendor payloads are not echoed into UI errors.

## Preserved custom behavior

- Full attached custom-instruction documents and Persona; no embeddings, vector index, or bundled speech models.
- Searchable combined LLM model picker, per-provider cached lists, and default OpenAI response tiers without Ultra.
- OpenAI and ElevenLabs cloud transcription, separate from LLM selection.
- Prep chat registration, automatic titles, sidebar counts and same-conversation interview start/stop/restart.
- Selected-message deletion, persistent context exclusions and independent forks.
- Normal popup click-to-type focus, stable macOS/helper identity handling, and lean architecture-specific packages.

## Deliberately excluded from this preview

Upstream's notepad-based replacement UI, connector integrations, hosted sharing, MCP/API exposure, subscription features, screen-share analysis, and local speech/indexing stack are not integrated. Some integrations depend on upstream services or unavailable premium code; the others need separate compatibility work. This preview does not claim full Natively v3 parity.

## Test evidence

- Local full suite: 1,082 passed, zero failed, 41 pre-existing skips. Branch CI includes the two additional IPC checks: **1,085 passed, zero failed, 41 skipped**.
- Browser harness mounts the real settings, launcher and popup React components with deterministic IPC fixtures. It checks send/delete/fork, provider settings, action creation/reload/execution, and top/middle/bottom popup focus. It does not substitute for real provider calls or native window testing.
- Two additional focused IPC wiring checks verify no-key behavior and the actual Tavily request payload (no transcript/document fields).
- Branch regression CI runs the production renderer build, full test suite and browser checks. Mac and Windows CI additionally build the actual packaged preview; Mac runtime, dependency inventory, DMG/signature integrity and macOS 27 Dock checks remain required.
- Existing backend TypeScript diagnostics are tracked separately; a successful esbuild bundle is not a claim of a clean backend type check.

## Trying the preview safely

Profile isolation runs as the first main-process import, before credential modules compute their paths. A bundled test using the real credential module verifies that a preview credential write leaves the stable directory untouched.

The preview version is `2.9.0-upstream.1`, with bundle/app ID `com.answercue.preview` and a separate user-data folder: `~/Library/Application Support/AnswerCue-UpstreamPreview` on macOS. Automatic stable-channel updates are disabled in this preview. It does not migrate the stable profile or copy credentials. Configure test keys yourself in the preview.

On Mac, retain `/Applications/AnswerCue.app`; rename the extracted preview bundle to `AnswerCue Preview.app` before copying it into Applications. Do not replace the stable bundle. On Windows, use a VM or separate test account for installer tests; the preview installer has not been approved for side-by-side installation in the same install directory.

Before any eventual main-branch promotion, restore the stable packaging app ID and assign a stable release version, review the branch diff, and rerun the full regression/build matrix. No stable release or main-branch merge is authorized by this preview build.

## Native acceptance checklist

- Test both OpenAI and ElevenLabs with real keys and live microphone + meeting audio; verify terminal credit/key errors and recovery after a dropped session.
- In the popup, click the text box at multiple positions and type with the call app running. Verify shortcuts, copy/paste, and pause/restart.
- Send prep chat, reopen it, start/stop/restart, delete selected turns, reopen again, fork, and verify the original stays unchanged.
- Verify Persona and full attached instruction content affect answers, default model/tier selection persists, and no local model is downloaded.
- Test search success, no-key, no-result and timeout behavior with a real Tavily key; ensure ordinary scoped and live turns do not search.
- Compare Dock behavior and audio routing on the installed Mac. GitHub runner checks cannot recreate a user's existing Dock cache, devices or macOS permission grants.
