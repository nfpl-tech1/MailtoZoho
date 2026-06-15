<!-- STATUS: ACTIVE -->
<!-- Last Updated: 2026-06-15 -->

# CLAUDE.md — eSanchit Email Automation

## Commands

```
npm run dev            # Start dev server (nodemon, auto-reload)
npm start              # Start production server
node --test test/      # Run tests (Node built-in test runner)
npx eslint .           # Lint codebase
npx prettier --check . # Check formatting
```

## Placement Rules

| Change Type | Location |
|-------------|----------|
| New email-processing feature | Create `controllers/{name}/`, `services/{name}/`, `utils/{name}/`, `routes/{name}/` — register in `routes/index.js` |
| New Zoho Creator operation | `src/services/common/zoho/{module}.js` — export via `zoho/index.js` |
| New shared service | `src/services/common/{name}.js` — re-export via `common/index.js` |
| New configurable setting | Add to `getConfigurableKeys()` in `config.service.js` + add default in `.env.example` |
| New cron endpoint | `src/routes/cron.routes.js` — must use `validateCronSecret` middleware |
| New email notification template | `src/services/common/email-notification/templates.js` |
| New test file | `test/{feature-name}.test.js` using `node:test` + `node:assert/strict` |

## Module Boundaries

- **Routes → Controllers → Services → Utils** is the only valid import direction
- Controllers never import from `utils/` directly — they call services
- Routes contain zero business logic — they map HTTP verbs to controller functions
- Feature services (`services/irn-drn-tracker/`, `services/record-query/`) import only from `services/common/`
- Feature folders never import from each other
- Utils are pure functions — no side effects, no service or config dependencies
- `services/common/zoho/` internal modules import only from `./config` and `./auth` within that directory
- Before creating any new utility, search `src/utils/` and `src/services/common/` for existing implementations

## Hard Rules

### Error Handling
- Every controller handler wraps its body in try/catch and calls `next(error)` in catch
- Empty catch blocks are forbidden — handle explicitly or re-throw with context
- Failed external API calls (Zoho, Gmail) return `{ success: false, error: <message> }`

### Configuration
- Config priority is law: Supabase override > `.env` value > hardcoded default
- Every new config key needs a full entry in `getConfigurableKeys()` (label, type, category, default, description)
- Never read `process.env` directly in controllers or services — use `getConfigService().get(key, default)`
- Secrets go in `.env` only — never in source code, never in `config.json`

### Size Triggers (enforced by ESLint `max-lines`, see `.eslintrc.json`)

| Artifact | Soft | Hard | Split trigger |
|----------|------|------|---------------|
| Controller file | 200 | 300 | >1 responsibility cluster |
| Service file | 300 | 500 | >1 responsibility cluster |
| Utility file | — | 200 | Single concern only |
| Route file | — | 100 | Route count |

### Testing
- Every parser and utility function must have tests
- Tests use Node's built-in test runner (`node:test` + `node:assert/strict`)
- Test files: `test/{feature-name}.test.js`

### Formatting and Linting (config-enforced)
- Prettier handles all formatting — see `.prettierrc`
- ESLint handles code quality — see `.eslintrc.json`

## Engineering Principles

1. **DRY:** Before creating a utility, search `src/utils/` and `src/services/common/`. If a function with 80%+ similar logic exists, extend it. Never copy-paste between feature folders.

2. **KISS:** If a solution needs more than one paragraph to explain, propose a simpler alternative.

3. **Single Responsibility:** Every file's purpose fits one sentence without "and." If you need "and," split the file.

4. **Dependency Inversion:** Feature controllers use singleton factory functions (`getConfigService()`, `getZohoService()`) — never `new Service()` inline in request handlers.

5. **YAGNI:** Do not build for imagined future requirements. Document follow-up opportunities; do not implement them.

6. **Separation of Concerns:** Parsing → `utils/`. Zoho API → `services/common/zoho/`. HTTP handling → `controllers/`. No mixing.

7. **Fail Fast:** Validate required fields at the controller level before passing to services. Return 400 for missing input.

## Never Do

- Commit `.env`, `credentials.json`, or `token.json`
- Hardcode Zoho form names, report names, or API endpoints — use config
- Import between feature folders (`irn-drn-tracker` ↔ `record-query`)
- Use Gmail OAuth2 API calls — IMAP with App Password is the active path
- Add cron routes without `validateCronSecret` middleware
- Mutate the `data` array parameter inside batch functions

## Pre-Commit Checklist

- [ ] `node --test test/` passes
- [ ] `npx eslint . --max-warnings 0` passes
- [ ] No secrets or `.env` values in committed files
- [ ] New config keys added to `getConfigurableKeys()` with full metadata
- [ ] New files follow placement rules
- [ ] Module boundaries respected — no cross-feature imports
- [ ] Controller handlers have try/catch with `next(error)`
- [ ] `.env.example` updated for any new environment variables

## Doc Routing Table

| WHEN | READ |
|------|------|
| Adding a new email-processing feature | `docs/ARCHITECTURE.md` §Feature Module Structure |
| Modifying Zoho API integration | `docs/ARCHITECTURE.md` §Zoho Service, `src/services/common/zoho/` |
| Changing config system | `docs/ARCHITECTURE.md` §Configuration System |
| Writing or modifying tests | `docs/TESTING.md` |
| Naming a file, function, or variable | `docs/CONVENTIONS.md` |
| Before writing code for any task | State which placement rule and which hard rules apply |

## Audit Clustering Rule

Scope /implement to root causes, not individual finding IDs.
When multiple audit findings share the same root cause, a single
work item may resolve all of them. List all resolved finding IDs
in the work item's audit-findings field.
One finding = one work item only when the finding has a unique root cause.
Run /implement once per root cause, not once per finding.

## Lessons Protocol

Governance observations → docs/LESSONS.md (never directly to CLAUDE.md)
Promotion: Count ≥ 2 + explicit user approval required
See docs/LESSONS.md for active lessons and promotion queue
