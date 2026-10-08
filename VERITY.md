# VERITY.md — Quality Gate

> This project uses [Verity](https://verity.md) to enforce quality and security standards on AI-generated code.

**URL:** https://verity.md
**Project:** this repository
**Standard:** v1 (derived from this codebase · ESLint9, Trivy, shellcheck)

## Quality Dimensions
- comprehensibility
- modularity
- type_safety
- test_adequacy

## Security Patterns
- no-hardcoded-secrets
- input-sanitization
- parameterized-queries
- dependency-verification
- no-unsafe-deserialization
- access-control-checks
- config-file-integrity

## How It Works
Every time the coding agent stops, the Verity hook:
1. Runs static analysis via @codacy/analysis-cli
2. Sends results + code to the Verity service
3. An independent model reviews the code
4. Returns PASS / WARN / FAIL with actionable findings

_This Standard was derived from the codebase: languages, frameworks and
architecture were detected, and the rules come from Verity's research-backed
patterns reference. Project-specific patterns are not part of it yet — add them
to `custom_patterns` in `.verity/standard.yaml` and run `verity standard push`._
