# Security policy

## Supported versions

The latest `main` branch is the only supported version. Pre-release builds and
forks are not covered.

## Reporting a vulnerability

Please report security issues privately to the maintainers. **Do not open a
public GitHub issue.**

Email: open a GitHub Security Advisory at
`https://github.com/<owner>/sutra-reader/security/advisories/new` (replace
`<owner>` with the active fork's namespace).

Include:
- A description of the issue
- Steps to reproduce
- Affected commit / version
- Your assessment of severity

You will receive an acknowledgement within 7 days and a remediation plan
within 30 days where the report is valid.

## Scope

In scope:
- The application code in this repository.
- The service worker / cache strategy.
- Any handling of CBETA XML that could introduce XSS via crafted markup.

Out of scope:
- Vulnerabilities in upstream content from `cbeta-org/xml-p5` — report those
  to CBETA directly.
- Browser bugs.
- Issues that require a malicious browser extension or root access.
