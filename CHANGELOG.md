# Changelog

## [2.8.10] - 2026-10-08

### Summary

AnswerCue v2.8.10 updates the desktop runtime and stabilizes macOS application/helper identities to reduce Dock registration churn. It addresses the reported disappearing duplicate icons while retaining the lean package, cloud transcription, and persistent interview features.

### What's New

- **Current Electron runtime:** Updated from Electron 33.4.11 to 44.7.0 for current macOS behavior.
- **Golden Gate release validation:** CI tests the packaged app on macOS 27, including a real BrowserWindow and repeated native Dock hide/show transitions without recording audio or calling provider APIs.

### Improvements

- Keeps macOS app identity separate from disguise presentation. Explicit disguises still change process/window presentation and available icons; they no longer rename the Mac application or inject a CFBundleName environment override into child processes.
- Retains electron-builder's canonical helper names, bundle identifiers, and background flags instead of changing helper bundle names to CoreServices.
- Initial normal mode uses the packaged Dock icon. Repeated identical disguise requests are idempotent, and normal mode does not schedule repeated process-title refreshes.
- Keeps the architecture-specific dependency allowlist and packaged runtime checks introduced in v2.8.8.

### Fixes

- Updates native rebuild/ABI tooling and the SQLite addon for Electron 44’s V8 API. Removes the deprecated duplicate electron-rebuild package. Database storage paths and schema are retained.
- Removed repeated Mac application-name and default-icon updates during startup.
- Removes the inherited CFBundleName override before creating the normal app windows and helpers.
- Adds regression checks for stable Mac identity and idempotent disguise/icon behavior.

### Technical

- Bumped package version to `2.8.10`; source and release notes are public in this fork.
- The user's diagnostic showed one foreground AnswerCue process and one accessory plugin helper. The extra icons disappeared when clicked. This rules out three registered foreground instances and points to stale Dock registrations, but does not prove which operation originally created them.
- The original v2.8.8 launch/reopen tests showed one Dock entry on clean macOS 14, 26, and 27 runners. The debugger-based visibility test was inconclusive; this release adds an isolated packaged native visibility harness.
- Full automated suite: **1,057 passed, zero failed, 41 skipped**. Renderer/production builds, packaged database/keytar/audio loading, image conversion, PDF/DOCX/TXT imports, per-architecture inventory, signatures, DMGs, and updater ZIP checks remain release requirements.
- Electron type checking retains existing fork diagnostics. Live provider-key transcription and installed-user microphone/system audio still require user-machine checks.
- Clean-runner validation cannot guarantee repair of a Dock cache already corrupted on another Mac. Existing ghost entries may need a one-time `killall Dock` after replacing and quitting the old app. This update avoids the unnecessary identity mutations that can contribute to future registration inconsistencies.
- User settings, keys, custom instructions, Persona, and interview history use the existing storage paths. No global Dock preferences or other applications' history are changed by the app.

See [.github/releases/v2.8.10.md](.github/releases/v2.8.10.md) for downloads and installation notes.

## [2.8.9] - 2026-10-08

### Summary

Unpublished candidate. Native rebuild tooling did not support Electron 44. Upload was blocked; the compatible build is v2.8.10.

## [2.8.8] - 2026-10-08

### Summary

AnswerCue v2.8.8 reduces Mac package size by removing unused libraries, shipping compiled frontend/backend code without duplicate SDK copies, and selecting native libraries for the target architecture. It retains the cloud transcription and interview features from v2.8.6.

### What's New

- **Packaged runtime verification:** Mac CI starts the built app in an isolated diagnostic mode and checks the native database, key storage module, audio addon, image conversion, PDF/DOCX/TXT imports, and transcription module loading without recording audio or calling provider APIs.
- **Package inventory checks:** CI rejects missing runtime files, development libraries, source maps, and native modules belonging to the other Mac architecture, and reports the largest packaged components.

### Improvements

- Frontend libraries and bundled JavaScript SDKs remain available for development and compilation but no longer ship as duplicate node_modules packages.
- Keeps only native/asset-backed runtime libraries and dynamic validation/authentication helpers in production dependencies.
- Removed unused ElevenLabs browser client, Google Stitch, Tavily, sqlite3, liquid-glass-react, three, tap, screenshot-desktop, unused styling/code-block utilities, and obsolete type packages. Legacy OCR remains development-only for its existing tests.
- Production Electron code is minified. Developer builds keep their existing layout and source maps for tests and debugging.
- Native audio, Sharp/libvips, and PDF canvas libraries are selected per Mac architecture. Both architectures are prepared during CI; each app ships only its matching files.
- Packaging includes runtime icons rather than the full source/readme artwork directory, and excludes unused PDF browser/ESM builds and dependency source maps.
- Compiled code retains generated third-party notices and the project license. The license for locally adapted glass-effect code is retained after removing its npm package.

### Fixes

- Mac file rules now retain the production allowlist instead of replacing it with exclusion-only rules, which previously caused the candidate to include source/build files and both audio architectures. Tests exercise the complete electron-builder matcher setup; CI rejects source, temporary, build, and environment files.
- PDF imports prefer the unpacked worker file so Node can load it from a real filesystem path.
- Ensures both Mac canvas variants are installed during cross-architecture builds, alongside Sharp's native image libraries.
- Local release commands use the same production Electron bundling mode as CI.

### Technical

- Bumped package version to `2.8.8`. Source and detailed release notes are published in this fork.
- Full automated suite: **1,055 passed, zero failed, 41 skipped**. Renderer type checking and production builds pass. Electron type checking retains the unchanged fork's 37 diagnostics, with no new diagnostics.
- File-selection tests exercise electron-builder's actual filters for both Mac architectures, including native library retention and rejection of other architectures.
- Mac release CI must pass packaged runtime probes, dependency inventories, signature checks, mounted DMG verification, and extracted updater ZIP checks before release assets are published. Intel runtime execution requires Rosetta on the build runner; CI explicitly reports a skip if unavailable.
- Electron's Chromium/Node runtime, native audio, database, key storage, image libraries, and PDF parsing remain required. No local AI model is included or downloaded.
- Existing provider keys, custom instructions, Persona, and interview history use the same storage paths. No user data or old model cache is deleted.
- Live transcription with user API keys, microphone/system audio capture, macOS permissions, and Dock behavior still require installed-Mac checks. Packaging probes do not record audio, read keys, or make paid API requests.

See [.github/releases/v2.8.8.md](.github/releases/v2.8.8.md) for downloads and installation notes.

## [2.8.7] - 2026-10-08

### Summary

Unpublished candidate. Package inventory checks caught a Mac file-rule override that included source/build files and the other audio architecture. Artifact upload was blocked; the corrected cleanup is released as v2.8.8.

## [2.8.6] - 2026-10-08

### Summary

AnswerCue v2.8.6 replaces local speech transcription with selectable OpenAI and ElevenLabs real-time transcription. LLM settings, transcription keys, and the active transcription model are managed in separate sections of AI Providers.

### What's New

- **Transcription providers:** Save an OpenAI or ElevenLabs API key, test session access, and choose an active transcription model in one searchable custom dropdown.
- **OpenAI GPT Live Transcribe:** Streams incremental text with the `minimal` delay setting and commits captured speech turns for final transcripts.
- **ElevenLabs Scribe v2 Realtime:** Streams partial and committed transcripts through its real-time WebSocket API.
- **Independent audio channels:** Microphone and meeting audio use separate sessions with the selected provider/model so user and interviewer roles remain distinct.

### Improvements

- Renamed the provider-card section to **LLM providers** while retaining the AI Providers settings tab. The LLM model and OpenAI response tier remain independent of transcription.
- OpenAI transcription uses its separate saved key, or reuses the saved OpenAI LLM key when no separate key is supplied.
- Existing local-only configurations choose an available cloud provider from saved keys. Explicitly selected transcription models persist across restarts and are not silently switched when their key is removed.
- First-run setup now configures cloud transcription instead of downloading a local model. Audio settings link to the transcription section while retaining device controls.
- Connection tests wait for an accepted provider session without recording audio. Transcription changes are disabled during an active interview; stop first, then configure and restart.

### Fixes

- Removed forced Moonshine routing and the local model download/preload path.
- Startup audio buffers until the provider accepts the session; buffers are bounded and discarded audio is reported.
- Captured PCM is mixed to mono and converted to the provider sample rate. Small capture chunks are grouped into approximately 100 ms packets.
- OpenAI final results are reconciled by turn identity and emitted in committed-turn order, even when completion events arrive out of order.
- Stop flushes remaining audio and waits up to two seconds for trailing transcript results before saving the interview. Connection failures, rejected credentials, quota errors, and drain timeouts are surfaced.
- Stop cancels reconnect/setup/keepalive timers; stale sockets cannot insert text into a restarted interview. Connection tests clean up immediately after session acceptance.

### Technical

- Bumped package version to `2.8.6`. Includes the full-file instruction context, Persona, searchable LLM chooser, restartable interviews, DMG signing repairs, and Dock fixes from previous releases.
- Removed local speech model code, the speech worker, model downloader, local-model UI/IPC, Hugging Face Transformers, ONNX Runtime, and unused ElevenLabs SDK/direct gRPC dependencies. No local speech model is bundled or downloaded. Existing user model caches are not automatically deleted.
- Legacy Google/Deepgram SDKs are development dependencies for historical adapter checks and are excluded from production dependencies.
- Full automated suite: **1,053 passed, zero failed, 41 skipped**. Renderer type checking and production builds pass. Electron type checking retains the unchanged fork's 37 diagnostics, with no new diagnostics.
- Protocol tests cover accepted sessions, startup buffering, PCM conversion, partial/final results, out-of-order completions, explicit commits, trailing results, bounded buffers, stale sockets, fatal provider errors, and timer cleanup. Credential tests cover upgrade behavior, key reuse, selected-model persistence, and missing keys.
- Browser checks exercise provider/model search, key saving, connection success/error UI, cloud-only onboarding, and start/stop/restart with the same interview identity. Browser checks use simulated Electron IPC; protocol tests use simulated provider sockets.
- **Live API audio remains unverified:** this environment could not securely pass user API keys into its test runner. Use Test Connection and an installed-Mac audio check to confirm your account's model access, network, transcription accuracy, and latency. No fixed end-to-end latency is promised.
- Audio now streams to the selected cloud transcription provider during interviews. Internet, provider API access, and usage charges are required. Two audio streams may incur separate usage. Updated privacy policy and in-app help reflect this behavior.
- macOS CI verifies app bundles, mounted DMGs, and extracted updater ZIPs before uploading release assets. Native permissions, audio capture, and Dock behavior still require installed-Mac confirmation.

See [.github/releases/v2.8.6.md](.github/releases/v2.8.6.md) for downloads and installation notes.

## [2.8.5] - 2026-10-08

### Summary

AnswerCue v2.8.5 keeps chat and repeated interview sessions in one conversation, sends complete instruction files and Persona directly to the LLM, and consolidates model selection into one searchable settings dropdown. It includes the macOS packaging and Dock fixes from v2.8.4.

### What's New

- **Restartable interviews:** Chat to add background, start the interview overlay, stop or close it, continue chatting, and restart the same interview. Earlier chat, transcript, documents, and AI answers remain available.
- **Complete instruction-file context:** Typed instructions and the full extracted text of the attached MD, TXT, PDF, or DOCX file go directly to the LLM, without embedding or vector search. The counter includes typed text and file content.
- **Searchable Active Model:** One custom dropdown combines cached chat models from every configured OpenAI, Google Gemini, and Anthropic Claude provider. Search by model or provider.

### Improvements

- Fetch Models refreshes and persists that provider's model cache; a failed refresh preserves the previous list. Changing or deleting a provider key invalidates its old cache.
- OpenAI's custom response-tier dropdown offers Auto, Standard, and Fast (Priority). Existing Ultrafast settings migrate to Fast while preserving the selected model.
- Provider cards retain key controls, Test Connection, and Fetch Models. Removed the redundant provider and interview model selectors, and the duplicate interview-sidebar collapse button.
- Pausing and restarting appends new transcript and usage to the same saved interview. Chat stays usable between sessions.
- Production Electron builds include only the main process, preload, speech worker, and PDF worker, without source maps or redundant development bundles.

### Fixes

- Saved AI Persona now accompanies Custom Instructions in cloud streaming and other chat requests, including after app restart.
- Removed application-level truncation of attached instruction content and preparation context.
- Closing Settings immediately after typing saves pending instructions and Persona edits. File replacement/removal preserves the latest typed instructions.
- Concurrent starts share one startup result; stop/start waits for teardown. Older background summaries cannot overwrite a newer saved session.
- Supports Responses-only OpenAI Pro/Codex chat models without overriding the chosen model, and expands provider model discovery with paginated Gemini and Claude lists.

### Technical

- Bumped package version to `2.8.5`; source and release notes are published in this fork.
- Removed MiniLM embedding weights, MobileBERT classifier weights, vector-search modules, and sqlite-vec dependencies. Required local-speech Transformers/ONNX packages remain; Moonshine downloads during setup.
- Full automated suite: **1,049 passed, zero failed, 41 skipped**. Renderer type checking and production builds pass. Electron type checking retains the unchanged fork's 37 diagnostics, with no new diagnostics.
- Browser checks exercised cross-provider search, refreshed caches, tier selection, complete-file character counts, immediate-close saving, and chat → start → stop → chat → restart with the same interview ID and earlier context.
- macOS CI verifies app signatures, mounted DMG contents, and extracted ZIP contents before uploading artifacts. Native audio, permissions, and Dock behavior still require confirmation on an installed Mac; browser checks use simulated Electron IPC.
- Complete context increases input tokens and can exceed the selected model's context window. Files above 15 MB are rejected; scanned PDFs require text extraction. The app does not silently trim the instruction file. Priority processing depends on provider/model/account availability and pricing.

See [.github/releases/v2.8.5.md](.github/releases/v2.8.5.md) for downloads and installation notes.

## [2.8.4] - 2026-10-08

### Summary

AnswerCue v2.8.4 fixes redundant macOS Dock visibility transitions during startup and reopening, and corrects interview-overlay cleanup during quitting and window recreation.

### What's New

- **Stable Dock visibility:** Reopening reuses the existing Dock entry; concurrent requests share one native visibility transition.

### Improvements

- Normal startup keeps the application's existing Dock activation policy.
- Stealth visibility changes converge on the latest setting and respect Electron's hide-after-show cooldown.
- Cancels queued Dock changes during shutdown.

### Fixes

- Removed normal startup's accessory-to-regular policy changes.
- Avoids calling dock.show when the icon is already visible.
- A visible interview overlay no longer cancels application quit.
- Closing and recreating the launcher destroys the previous overlay instead of orphaning its renderer.

### Technical

- Bumped package version to `2.8.4`.
- Eleven focused checks cover normal startup, repeated activation, concurrent show requests, rapid toggles, cooldown cancellation, native errors, shutdown, and overlay cleanup.
- The reported duplicate icons appeared with one main app process and correctly configured helper background flags. A Dock restart cleared them temporarily; the code fix removes risky visibility transitions rather than changing helper identities or the single-instance lock.
- macOS package signature verification remains required for app bundles, mounted DMGs, and extracted ZIPs. Installed-Mac confirmation of Dock behavior remains necessary.
- OpenAI response tiers, saved settings, and interview history retain their existing behavior.

See [.github/releases/v2.8.4.md](.github/releases/v2.8.4.md) for downloads and installation notes.

## [2.8.3] - 2026-10-08

### Summary

AnswerCue v2.8.3 fixes macOS packaging defects that can cause the app to be reported as damaged. It retains the OpenAI response-tier settings from v2.8.2.

### What's New

- **Verified Mac packages:** Signature checks cover the built app, the app inside each DMG, and the app extracted from each updater ZIP.

### Improvements

- Creates ad-hoc DMGs from pristine app bundles using `ditto` and `hdiutil`.
- Preserves nested signatures and native-module entitlements during packaging.
- Release uploads stop when signature, disk-image, or updater-manifest checks fail.

### Fixes

- Reseals the outer app after native modules are signed.
- Native-module signing failures now stop the build.
- Avoids electron-builder's signature-changing DMG layout in the ad-hoc packaging path.

### Technical

- Bumped package version to `2.8.3`.
- Signing regression checks passed locally. Actual macOS package verification runs in GitHub Actions before upload.
- This release is ad-hoc signed, not Developer ID signed or notarized. Valid signatures do not provide automatic Gatekeeper approval; Apple signing/notarization credentials are required for that.
- Manual launch, audio, and permission checks on an installed Mac remain necessary.

See [.github/releases/v2.8.3.md](.github/releases/v2.8.3.md) for platform downloads and signing status.

## [2.8.2] - 2026-10-08

### Summary

AnswerCue v2.8.2 adds a saved OpenAI response-tier selector in Settings and publishes Apple Silicon and Intel DMGs from this fork.

### What's New

- **Default response tier:** Choose Auto, Standard, Fast (Priority), or Ultrafast inside Settings → AI Providers → OpenAI.
- **Ultrafast support:** Uses GPT 6 Astra through the Responses API for OpenAI text, screenshot, and background answers.
- **Mac installers:** Architecture-specific DMGs and updater ZIPs are available from this fork.

### Improvements

- Saves the tier automatically, applies it to subsequent requests, and restores it after restart.
- Test Connection uses the saved tier.
- Preserves streaming, image inputs, low reasoning, prompt caching, cancellation, and first-token timeouts.
- Update downloads and release notes point to `devasheeshG/AnswerCue`.

### Fixes

- Prevents retries from appending a second answer to a partially streamed response.
- Ultrafast does not silently downgrade to a different OpenAI model.

### Technical

- Bumped package version to `2.8.2`.
- Auto follows the OpenAI project's default; Standard requests normal processing; Fast requests Priority processing for the selected supported model.
- Ultrafast uses GPT 6 Astra even when another OpenAI model is selected. Higher pricing and lower rate limits apply.
- Transcription, embeddings, other providers, and the separate Groq Fast Response control retain their own settings.
- Renderer/Electron builds and five new transport tests passed. Existing repository test and type-check failures were unchanged; no paid OpenAI requests were made.

See [.github/releases/v2.8.2.md](.github/releases/v2.8.2.md) for platform downloads and signing status.

## [2.8.1] - 2026-10-04

### Summary

AnswerCue v2.8.1 updates default AI models, removes retired GPT 5.5 options, and fixes model-selection persistence.

### What's New

- **OpenAI default:** GPT 6.1 Sol (`gpt-6.1-sol`).
- **Anthropic default:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Persistent setup choice:** The first-run model selection survives app restarts and interview completion.

### Improvements

- Shared defaults align onboarding, Settings, provider requests, connection checks, and text/screenshot fallback baselines.
- Google remains Gemini 3.5 Flash; existing low-reasoning settings remain in place.
- Preserves valid saved model choices, interview history, documents, and API keys.

### Fixes

- Removed GPT 5.5, GPT 5.5 Thinking, and the GPT 5.5 Instant (`chat-latest`) alias from model lists, discovery, and Codex CLI presets.
- Migrates retired OpenAI preferences to GPT 6.1 Sol on startup.
- Prevents removed models from returning after an upgrade. Claude Opus 5.5 remains available.

### Technical

- Bumped package version to `2.8.1`.
- Original release included Developer ID signed/notarized macOS artifacts and Azure-signed Windows artifacts.
- Includes the v2.8.0 workspace improvements and retains the existing live interview shell appearance.
- Model access and API billing depend on the user's provider account; these defaults do not include API credits.

See [.github/releases/v2.8.1.md](.github/releases/v2.8.1.md) for platform downloads and signing status.

## [2.8.0] - 2026-10-02

### Summary

AnswerCue v2.8.0 refreshes the interview workspace, adds new OpenAI and Anthropic models, and improves chat, document handling, and accessibility.

### What's New

- **Interview workspace:** Collapsible interview and settings panels, responsive side drawers, and saved-interview search.
- **Chat controls:** Multiline composer, preparation starters, message timestamps, copy actions, and jump-to-latest navigation.
- **AI models:** GPT 6 Astra, GPT 6.1 Sol, GPT 6 Luna, GPT 5.6 Sol/Terra/Luna, and Claude Opus 5/5.5 and Sonnet 5/5.5.

### Improvements

- Refined light and dark themes, spacing, and AnswerCue accents.
- Reusable document attachments and document-only messages retain their conversation context.
- Improved code blocks, inline code, Markdown tables, searchable model selection, and audio-device controls.
- Shared model metadata aligns reasoning settings, output limits, and first-token budgets.
- Improved keyboard navigation, focus handling, and Settings layouts.

### Fixes

- Screenshot requests try the selected chat model before provider fallbacks.
- Reading older messages no longer forces the chat back to the latest response.
- Escape closes the active menu without closing the panel behind it.
- Fixed duplicate Settings animation keys and the floating Help button overlapping Send.

### Technical

- Bumped package version to `2.8.0`.
- Original release included Developer ID signed/notarized macOS artifacts and Azure-signed Windows artifacts.
- Retained the existing floating live interview shell appearance.
- Live audio, OS permissions, model access, and API billing remain dependent on the user's device and provider account.

See [.github/releases/v2.8.0.md](.github/releases/v2.8.0.md) for platform downloads and signing status.

## [2.7.3] - 2026-06-15

### Summary

AnswerCue v2.7.3 completes the first AnswerCue-branded release pass: new cross-platform logo assets, cleaner About text, focused model support, and inline in-app updates wired to the AnswerCue GitHub release channel.

### What's New

- **New AnswerCue logo system:** Added the flag-road mark as the app icon source and regenerated macOS `.icns`, Windows `.ico`, Linux PNG sizes, tray template, and in-app logo assets.
- **Inline update experience:** Added a Codex-style sidebar update row for available, downloading, and restart-to-install update states.
- **Interview-first About page:** Rebuilt the About screen around AnswerCue's prep, live interview, post-interview, privacy, and platform support story.
- **Focused Claude support:** Limited Anthropic selection to the latest Opus models plus Sonnet 4.6.

### Improvements

- **AnswerCue app identity:** Updated the packaged app id to `com.answercue.desktop` and moved Windows taskbar grouping away from the old upstream identity.
- **Release pipeline branding:** Updated macOS and Windows artifact names, release workflow labels, update instructions, and release templates to AnswerCue.
- **Update source isolation:** Confirmed updater metadata and release notes are pulled from `FarzamHejaziK/AnswerCue`, not the upstream repository.
- **Live interview context:** Included prep chat and selected document markdown in the live interview prompt context path.

### Fixes

- Fixed stale app names in update instructions and macOS release verification.
- Fixed the macOS release workflow check that still searched for the old app bundle name.
- Fixed Windows release packaging when Transformers.js downloads the Moonshine Base quantized graph successfully but ONNX runtime validation fails during install.
- Added the missing macOS entitlements files required by both unsigned ad-hoc packaging and future signed/notarized builds.
- Increased the macOS DMG filesystem size so Apple Silicon packages fit after embedding the local transcription model.
- Adjusted unsigned macOS release packaging so Apple Silicon ships as the updater ZIP while Intel keeps the DMG target.
- Removed the old update promotion popup path so update notices no longer look like promotional UI.
- Removed the confusing `Clear` control from the interview header.

### Technical

- Bumped the package version to `2.7.3` for release detection.
- Added `answercueSigned` metadata for signed macOS auto-install gating while preserving compatibility with older `nativelySigned` builds.
- Updated GitHub Actions Windows publishing so tagged releases can attach `AnswerCue-Setup-VERSION.exe` and `latest.yml`.
- Regenerated all platform icon outputs from the new logo source.

## [2.0.7] - 2026-03-20

### What's New
    
- **Single-Trigger Analysis**: Added a new global keybind (`Cmd+Shift+Enter`) for "Capture and Process" to instantly take a screenshot and run AI analysis.
- **Tavily Search Integration**: Replaced Google Custom Search Engine with the Tavily Search API. Features advanced depth and raw content extraction for vastly improved RAG and Company Research.
- **Enhanced Company Dossiers**: Massively expanded the Premium Profile Intelligence UI. Now includes interview difficulty badges, a 5-star work culture grid with sub-dimensions, employee reviews with sentiment analysis, critics/complaints tracking, and core benefits pills.

### Improvements
    
- **AI Language Strict Enforcement**: Rewrote the AI language enforcement pipeline. Native languages (Spanish, French, etc.) are now strongly prioritized over system prompt defaults using a triple-layer strict injection, guaranteeing the AI never incorrectly defaults back to English.
- **Model Selection Accuracy**: Rewrote `LLMHelper` routing logic to guarantee your specifically selected cloud provider model (e.g., `gpt-4o`, `claude-3-5-sonnet`) is rigorously respected during vision fallbacks, multimodal processing, and streaming.
- **Robust AI Fallbacks**: Added Gemini Flash and local Ollama models to the structured generation fallback chains, ensuring features like resume parsing work continuously even when primary models face rate limits or outages.
- **Smoother Animations**: Mac window transitions now utilize zero-opacity pre-hiding to eliminate jarring animation flashes during rapid screenshot captures.
    
### Fixes
    
- Fixed a bug where custom cURL endpoints and the "What to Say" auto-suggestion path would occasionally bypass the user's language preferences.
- Fixed the OpenAI API validation ping by upgrading the deprecated connection test model to `gpt-4o-mini`.
- Fixed UI sync issues where the AI response language dropdown could fall out of sync with the backend upon an IPC failure via a new optimistic playback system.
- Removed unused dead user interface components and completely sanitized legacy template variables from core system prompts.

## [2.0.5] - 2026-03-15

### Improvements

- **Stealth Mode UI**: The Process Disguise selector is now visually disabled and locked while Undetectable mode is active, preventing accidental state mismatches.
- **State Synchronization**: Greatly improved internal state synchronization across all application windows (Settings, Launcher, Overlay).

### Fixes

- **Infinite Feedback Loops**: Completely eliminated the bug where toggling Undetectable mode would sometimes cause the app to rapidly toggle itself on and off.
- **Delayed Dock Reappearance**: Fixed a regression where the macOS dock icon would mysteriously reappear several seconds after entering stealth mode if a disguise had recently been changed.
- **Initial State Loading**: Fixed an issue where the Settings UI would briefly show incorrect toggle states when first opened.
- **macOS OS-level Events**: Hardened the app against macOS `activate` events (like clicking the app in Finder) accidentally breaking stealth mode.

### Technical

- Refactored IPC (Inter-Process Communication) listeners for `SettingsPopup` and `SettingsOverlay` to use a strict one-way (receive-only) data binding pattern.
- Added strict management and cancellation of `forceUpdate` timeouts during stealth mode transitions.
- Added explicit type safety for the new getters in `electron.d.ts`.

## [2.0.4] - 2026-03-14

### Summary

Version 2.0.4 introduces a massive architectural overhaul to the native audio pipeline, guaranteeing production-ready stability, true zero-allocation data transfer, and instantaneous STT responsiveness with WebRTC ML-based VAD.

### What's New

- **Two-Stage Silence Processing**: Replaced basic RMS noise gating with a two-stage pipeline combining an adaptive RMS threshold and WebRTC Machine Learning VAD. Rejects typing, fan noise, and non-speech sounds before they bill STT APIs.
- **Zero-Copy ABI Transfers**: Transitioned the `ThreadsafeFunction` bridging to direct `napi::Buffer` (Uint8Array) allocations, completely eliminating V8 garbage collection pressure during continuous capture.
- **Sliding-Window RAG**: Implemented a 50-token semantic overlap in `SemanticChunker.ts` to prevent conversational context loss across chunk boundaries.

### Improvements

- **Latency & Responsiveness Tuning**: Stripped redundant TS debouncing, slashed `MIN_BUFFER_BYTES`, and reduced native hangover, achieving a ~300ms reduction in end-to-end transcription latency. short utterances ("Yes", "Stop") no longer sit trapped in the buffer.
- Removed floating-point division truncation for superior downsampling from 44.1kHz external microphones.

### Fixes

- Fixed a critical bug where the native Rust monitor returned a hardcoded `16000Hz` while actually streaming 48kHz audio. Now syncs true hardware sample rates.
- Resolved the "Input missing" silent crash bug on microphone restarts by properly recreating the CPAL stream.
- Restored the 10s continuous speech backstop for REST APIs to prevent unbounded buffer growth.
- Added missing `notifySpeechEnded()` properties and cleaned up dangerous type casts.

### Technical

- Audio processing transitioned entirely to strict ABI memory bridging (`napi::Buffer`)
- Re-architected native silence_suppression state machine around WebRTC VAD inputs.

## [2.0.3] - 2026-03-13

### What's New

- **Dynamic AI Model Selection:** Replaced static model lists with dynamic dropdowns. Your preferred models synced from providers (like OpenAI, Anthropic, Google) now automatically appear across the entire app.
- **Multimodal Resilience:** Added a "Smart Dynamic Fallback" using Groq Llama 4 Scout. If default vision models fail or get rate-limited during screen analysis, AnswerCue instantly reroutes the image to ensure uninterrupted performance.
- **Multiple Screenshot Support:** The AnswerCue Interface can now handle and process multiple attached screenshots simultaneously instead of just one.
- **Improved Settings UX:** API keys now auto-save after 5 seconds of inactivity, and selecting a preferred model immediately updates the rest of the application without requiring a page reload.

### Architecture & Fixes

- **Better Embeddings:** Migrated from Gemini Embedding to a completely new and more robust embedding architecture.
- **Claude Fixes:** Resolved max_tokens and context limits issues specific to Anthropic Claude interactions.
- **DRY Refactoring:** Centralized model configuration strings across the codebase to ensure easier future updates.

## [2.0.2] - 2026-03-10

### Summary

v2.0.2 focuses on fixing Windows system audio capture, improving RAG stability, and resolving critical Soniox STT configuration issues.

### What's New

- Fully functional system audio capture for Windows
- Introduced system for manual transcript finalization and interim/final bridging during recordings

### Improvements

- Migrated to `app.getAppPath()` for reliable cross-platform resource discovery
- Ensured `sqlite-vec` compatibility and fixed embedding queue management
- Upgraded `@google/genai` and optimized embedding dimensionality for lower latency

### Fixes

- Improved Soniox STT streaming reliability, manual flushing, and configuration persistence
- Resolved application entry point and module resolution issues in production builds
- Fixed transcript bridging for manual recording mode
- Corrected stealth activation and window focus inconsistencies

### Technical

- Dependency updates for `@google/genai`
- Cleaned up native compiler warnings for Windows
- Fixed module resolution for internal Electron paths

## [2.0.1] - 2026-03-06

### New Features

- **Premium Profile Intelligence**: Job Description (JD) and Resume context awareness, company research, and negotiation assistance.
- **Live Meeting RAG**: Instant intelligent retrieval of context directly during a live meeting using local vectors.
- **Soniox Speech Provider**: Added support for ultra-fast and highly accurate streaming STT with Soniox.
- **Multilingual Support**: Choose from various response languages, set speech recognition matching specific accents and dialects.

### Improvements & Fixes

- Fixed numerous issues and merged 3 community pull requests to improve overall stability.

## [1.1.8] - 2026-02-23

### Summary

Patch update addressing OpenAI GPT 5.x compatibility and increasing token output limits for all providers.

### What's New

- Replaced deprecated `max_tokens` parameter with `max_completion_tokens` required by GPT 5.x models.
- Increased max output tokens for OpenAI (GPT 5.2) and Claude (Sonnet 4.5) to 65,536.
- Increased max output tokens for Groq (Llama 3.3 70B) to 32,768.

### Improvements

- Improved response length capabilities across all text-generation AI models.
- Updated connection test model to use `gpt-5.2-chat-latest` instead of the deprecated `gpt-3.5-turbo`.

### Fixes

- Fixed 400 error when using OpenAI GPT 5.x models for text queries and toggle actions.

### Technical

- Replaced `max_tokens` with `max_completion_tokens` in `LLMHelper.ts` and `ipcHandlers.ts`.

## [1.1.7] - 2026-02-20

### Summary

Security hardening, memory optimization, and stability improvements for a more robust and reliable experience.

### What's New

- API rate limiting to prevent 429 errors on free-tier plans (Gemini, Groq, OpenAI, Claude)
- Cross-platform screenshot support (macOS, Linux, Windows)
- Official website link added to the About section

### Improvements

- Smarter transcript memory management with epoch summarization instead of hard truncation — no more losing early meeting context
- API keys are now scrubbed from memory on app quit to minimize exposure window
- Credentials manager now overwrites key data before disposal for enhanced security
- Helper process renaming for improved stealth in Activity Monitor

### Fixes

- Fixed V8/Electron entitlements crash on Intel Macs by including entitlements.mac.plist during ad-hoc signing
- Fixed process disguise not applying correctly when undetectable mode is toggled on
- Fixed usage array capping with dedicated helper method to prevent unbounded growth

### Technical

- Added `RateLimiter` service (token bucket algorithm with configurable burst and refill rates)
- Added `PRIVACY.md` and `SECURITY.md` policy documents
- Refactored ad-hoc signing script with helper renaming and proper entitlements flow
- Version bump to 1.1.7

## [1.1.6] - 2026-02-15

### New Features

- **Speech Providers**: Added support for multiple speech providers including Google, Groq, OpenAI, Deepgram, ElevenLabs, Azure, and IBM Watson.
- **Fast Response Mode**: Introduced ultra-fast text responses using Groq Llama 3.
- **Local RAG & Memory**: Full offline vector retrieval for past meetings using SQLite.
- **Custom Key Bindings**: Added ability to customize global shortcuts for easier control.
- **Stealth Mode Improvements**: Enhanced disguise modes (Terminal, Settings, Activity Monitor) for better privacy.
- **Markdown Support**: Improved Markdown rendering in the Usage section for better readability of AI responses.
- **Image Processing**: Integrated `sharp` for optimized image handling and faster analysis.

### Improvements & Fixes

- Fixed various UI bugs and focus stealing issues.
- Improved application stability and performance.

## [1.1.5] - 2026-02-13

### Summary

The Stealth & Intelligence Update: Enhances stealth capabilities, expands AI provider support, and improves local AI integration.

### What's New

- **Native Speech Provider Support:** Added Deepgram, Groq, and OpenAI speech providers.
- **Custom LLM Providers:** Connect to any OpenAI-compatible API including OpenRouter and DeepSeek.
- **Smart Local AI:** Auto-detection of available Ollama models for local AI.
- **Global Spotlight Search:** Toggle chat overlay with Cmd+K (macOS) and Ctrl+K (Windows/Linux).
- **Masquerading Mode:** Appear as system processes like Terminal or Activity Monitor.
- **Improved Stealth Mode:** Enhanced activation and window focus transitions.

### Improvements

- **Natural Responses:** Updated system prompts for more concise and natural responses.
- **Conversational Logic:** Reduced robotic preambles and unnecessary explanations.
- **Performance:** Improved UI scaling and reduced speech-to-text latency.

### Fixes

- No critical fixes reported in this release.

### Technical

- Internal logic refinements for improved conversational flow.
- Updater and background process stability improvements.

#### macOS Installation (Unsigned Build)

If you see "App is damaged":

1. Move the app to your Applications folder.
2. Open Terminal and run: `xattr -cr /Applications/AnswerCue.app`

## [1.1.4] - 2026-02-12

### What's New in v1.1.4

- **Custom LLM Providers:** Connect to any OpenAI-compatible API (OpenRouter, DeepSeek, commercial endpoints) simply by pasting a cURL command.
- **Smart Local AI:** Enhanced Ollama integration that automatically detects and lists your available local models—no configuration required.
- **Refined Human Persona:** Major updates to system prompts (`prompts.ts`) to ensure responses are concise, conversational, and indistinguishable from a real candidate.
- **Anti-Chatbot Logic:** Specific negative constraints to prevent "AI-like" lectures, distinct "robot" preambles, and over-explanation.
- **Global Spotlight Search:** Access AI chat instantly with `Cmd+K` / `Ctrl+K`.
- **Masquerading (Undetectable Mode):** Stealth capability to disguise the app as common utility processes (Terminal, Activity Monitor) for discreet usage.
