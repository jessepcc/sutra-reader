# Contributing to 經閣 / Sutra Reader

Thank you for your interest. A few non-negotiables before you start.

## Hard "no"s

The following changes will be **closed without merge**:

1. Any analytics, fingerprinting, third-party tracker, or "telemetry" beacon —
   including self-hosted variants — added on by default.
2. Ads or any commercial sponsorship surface.
3. Removing or hiding the CBETA attribution footer from the reader.
4. Adding text content directly to the repo (we fetch it; we don't bundle it).
5. Lowering content licence visibility (NOTICE.md, About page, footer).

Any future telemetry must be **off by default**, **opt-in only**, and
**self-hostable** with no third-party processor.

## DCO sign-off

All commits require a [Developer Certificate of Origin](https://developercertificate.org)
sign-off: append `-s` to your `git commit`, e.g. `git commit -s -m "..."`.

## Code

- TypeScript strict mode.
- Pure logic in `src/lib/**` must have a co-located `*.test.ts` and stay ≥ 70%
  covered.
- No new dependencies without justification in the PR description.
- Keep the app shell ≤ 150 KB gzipped (perf budget — SPEC §8).

## Issues

For a security vulnerability, see [SECURITY.md](./SECURITY.md). Do **not**
file a public issue.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
