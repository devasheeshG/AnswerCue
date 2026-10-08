# AnswerCue Release Process

Release channel: `devasheeshG/AnswerCue`.

## Release Notes Format

Use the established v2.7.3–v2.7.5 section format for every new release:

```markdown
Release date: YYYY-MM-DD

## Summary

AnswerCue vX.Y.Z describes the main user-visible change.

## What's New

- New features.

## Improvements

- Improvements to existing behavior.

## Fixes

- Fixed bugs.

## Technical

- Version, relevant implementation details, validation, and limitations.

## Platform Downloads

### macOS

- Actual Apple Silicon and Intel assets; state signing/notarization status.

### Windows

- Actual Windows assets, or state that none were published.

### Linux

- Actual Linux assets, or state that none were published.
```

Use the actual publication date. Historical v2.8.0 and v2.8.1 notes retain their original release dates. List only produced artifacts and verified signing status. Keep release notes, CHANGELOG.md, and the GitHub release body consistent.

## Release Checklist

1. Update package.json and package-lock.json to the same version.
2. Add the dated changelog entry and .github/releases/vX.Y.Z.md.
3. Run checks appropriate to the change and record material limitations.
4. Commit and push the source and documentation.
5. Create a draft release for the exact source commit.
6. Run the macOS workflow against that tag.
7. Verify the workflow result, both DMGs, both ZIPs, updater metadata, and signing status before publishing.

## macOS Artifacts

- Apple Silicon: `AnswerCue-X.Y.Z-arm64.dmg` and `AnswerCue-X.Y.Z-arm64-mac.zip`.
- Intel: `AnswerCue-X.Y.Z-x64.dmg` and `AnswerCue-X.Y.Z-mac.zip`.
- Update metadata: `latest-mac.yml` and generated ZIP blockmaps.

The ad-hoc path builds ZIPs with electron-builder, reseals the app after native-module signing, and creates DMGs with ditto/hdiutil. Signature checks cover app bundles, mounted DMGs, and extracted ZIPs. Disk-image and updater-manifest checks must pass before upload.

Developer ID signing and notarization require Apple repository secrets. Set require_signing=true to make those credentials mandatory. Without them, artifacts are ad-hoc signed and unnotarized; disclose this in release notes. Signature integrity and Gatekeeper approval are separate checks.

## Create and Build a Release

```bash
git tag vX.Y.Z
git push --atomic origin main vX.Y.Z

gh release create vX.Y.Z \
  --repo devasheeshG/AnswerCue --verify-tag --draft \
  --title "AnswerCue vX.Y.Z" \
  --notes-file .github/releases/vX.Y.Z.md

gh workflow run release-macos.yml --repo devasheeshG/AnswerCue \
  --ref main -f release_tag=vX.Y.Z -F require_signing=false
```

For a signed/notarized release, configure Apple secrets and set require_signing=true. After verifying the build and assets:

```bash
gh release edit vX.Y.Z --repo devasheeshG/AnswerCue --draft=false --latest
```

## Updating Published Notes

Edit the existing release in place so tags, source links, and downloaded assets retain their identity:

```bash
gh release edit vX.Y.Z --repo devasheeshG/AnswerCue \
  --title "AnswerCue vX.Y.Z" --notes-file .github/releases/vX.Y.Z.md
```

Historical v2.8.0 and v2.8.1 binaries were published by the original release channel. Reformatting their source notes does not rebuild or republish those binaries in this fork.
