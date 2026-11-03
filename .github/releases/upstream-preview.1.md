Release date: 2026-11-03

## Summary

First isolated upstream integration preview, built from `integration/natively-v3-preview`. Stable AnswerCue v2.8.12 and `main` are unchanged. This is a selective compatibility preview, not a complete Natively v3 replacement.

## What's New

- Typed-chat web search with a user-supplied Tavily key under AI Providers → Preview features. Search is limited to explicit requests in scoped interview chat with capture stopped; live interview answers do not search.
- Up to four named custom overlay actions with persisted plain-language instructions, using the selected LLM and the existing chat context/preferences.

## Improvements

- Preview profile: `~/Library/Application Support/AnswerCue-UpstreamPreview` on macOS; no stable credentials or conversations are migrated.
- Preview app identity is `com.answercue.preview`; stable-channel automatic updates are disabled in this build.
- Retains full custom-instruction documents, Persona, searchable LLM selection, OpenAI tiers, cloud transcription, persistent prep chat, automatic titles, pause/restart, message exclusions, forks and popup click-to-type behavior.

## Fixes

- ElevenLabs recoverable session errors reconnect rather than permanently stopping capture.
- Healthy ElevenLabs sessions reset the failed-short-session retry budget. Key, credit and terms errors remain terminal, without echoing sensitive vendor payloads.

## Technical

- Upstream modules sourced from Natively commit `ccd3540683b6010f632428350cf06f777972692f`; original AGPL licensing is retained.
- Branch regression CI: **1,084 passed, zero failed, 41 skipped**, production renderer build and browser workflow checks passed.
- Native runtime/inventory, DMG/signature checks, Mac Dock checks and Windows packaging must pass before these artifacts are published.
- No new local speech models, embeddings, vector indexing or model downloads.
- Notepad replacement UI, connectors, hosted sharing, MCP/API exposure, subscription services and screenshot/reordering support for custom buttons are not included in this first preview.
- Live provider calls and actual Mac audio/focus/permission behavior require installed-device testing. Browser checks use deterministic IPC fixtures; existing backend TypeScript diagnostics remain.
- Do not merge this preview directly into production. Stable version/app-ID restoration and approval are required before any main-branch promotion.

## Platform Downloads

### macOS

Use `AnswerCue-2.9.0-upstream.1-arm64-mac.zip` for Apple Silicon or `AnswerCue-2.9.0-upstream.1-mac.zip` for Intel. DMGs are also included.

**Keep your stable app.** Extract the preview ZIP and rename the bundle to `AnswerCue Preview.app` before copying it into Applications. Configure test credentials in the preview's separate profile. Builds are ad-hoc signed and unnotarized.

### Windows

`AnswerCue-Setup-2.9.0-upstream.1.exe`. Unsigned when signing credentials are unavailable. Test in a VM or a separate test account; same-directory side-by-side installation is not approved for this preview.

### Linux

No Linux installer is included. Linux CI validates the renderer and automated test harness.
