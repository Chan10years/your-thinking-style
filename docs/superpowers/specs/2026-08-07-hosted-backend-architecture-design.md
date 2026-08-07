# Hosted Backend Architecture Design

## Status and authority

This document is the approved architecture authority for the first hosted account
backend. It covers local development of the backend, not cloud deployment or final
product UI polish. Any implementation that changes the product boundary, data
retention, authentication method, or runtime stack must update this design and be
approved before code changes continue.

## Product objective

Build a reproducible TypeScript backend that can be completed and verified on one
developer machine before deployment. The hosted edition must support email accounts,
editable profiles, custom avatars, successful-analysis history, deletion, and minimal
usage reporting for an expected first-year population of 1,000–2,000 users.

The existing C++ analysis flow remains the product core. The backend must not delay
later refinement of model feedback, response formatting, correction structure, or UI;
those product improvements start only after the backend completion gate passes.

## Fixed architecture decision

The project remains one modular Next.js application. React is the UI library;
Next.js is the full-stack framework; TypeScript is used in browser and server code.
Do not introduce Express, NestJS, a second backend repository, or a second application
server for this phase.

Server code is separated by responsibility:

```text
src/
├─ app/api/                 thin HTTP route handlers
├─ config/                  edition capabilities
├─ server/
│  ├─ auth/                 authentication and session helpers
│  ├─ db/                   connection, schema and migrations
│  ├─ profile/              profile rules and persistence
│  ├─ history/              history persistence and ownership
│  ├─ analysis/             analysis orchestration
│  ├─ metrics/              aggregate usage reporting
│  ├─ email/                authentication email adapter
│  └─ storage/              avatar storage adapter
├─ schemas/                 Zod request and response contracts
└─ types/                   shared domain types
```

Route handlers parse input, resolve the current actor, call a service, and translate
the result to HTTP. They do not contain database queries, file operations, email
templates, or DeepSeek request construction. Services do not read React state or
construct HTTP responses. Repositories and adapters hide replaceable infrastructure.

## Runtime editions

The repository contains the complete source, but runtime capability is explicit:

| Capability | `local` | `hosted` |
| --- | --- | --- |
| C++ diagnosis | yes | yes |
| User-supplied DeepSeek key | yes | yes |
| Brand homepage | no | yes |
| Registration and login | no | yes |
| Database | no | yes |
| Profiles and avatars | no | yes |
| Analysis history | no | yes |
| Usage reporting | no | yes |
| Official telemetry | no | minimal hosted aggregates only |

`APP_EDITION` accepts only `local` or `hosted` and defaults to `local`. Capability
checks live in one module. A local start must not initialize an authentication library,
open a database connection, require SMTP configuration, write activity data, or call an
official server. Disabled hosted routes return 404.

Two different uses of “local” must remain clear:

- **Local edition:** the public self-hostable diagnosis tool with no account backend.
- **Hosted development on localhost:** the full hosted edition using local Docker
  infrastructure before cloud deployment.

## Fixed technology stack

| Concern | Decision | Source, license, and risk |
| --- | --- | --- |
| Language | TypeScript 5 with `strict: true` | Already used across the project; no second language |
| Runtime | Node.js 24 LTS | Pin the major version across development, CI, and production |
| Framework | Next.js 16 App Router and React 19 | Existing stack; use Node route handlers, not Edge runtime |
| Validation | Zod 4 | Existing request and model-response contract library |
| Authentication | Better Auth | MIT, active, official Next.js 16 support; pin an exact compatible version |
| Database | PostgreSQL | One fixed container major version in development and production |
| ORM | Drizzle ORM and Drizzle Kit | Apache-2.0, typed SQL and readable migrations; do not use RC releases |
| Driver | `pg` / node-postgres | MIT, mature pooling support |
| Development mail | Mailpit | MIT, local-only SMTP inbox; never expose publicly |
| Avatar processing | Sharp | Apache-2.0, active; native binary compatibility must be tested in the production image |
| Tests | Node test runner with `tsx` | Continue the existing test style; do not add another test framework without need |
| Package manager | npm with `package-lock.json` | Use `npm ci` for reproducible installs |
| Infrastructure | Docker Compose for PostgreSQL and Mailpit | The Next.js app runs directly during development for easier learning and debugging |

All new dependencies require an exact stable version and lockfile update. Before a
dependency is added, record its source, license, compatibility, modification surface,
and operational risk in the implementation change. Do not copy authentication,
database, SMTP, or image-processing code from unlicensed snippets.

## Authentication scope

Implement only:

- email and password registration;
- required email verification;
- email and password login;
- password reset by email;
- current-device sign-out;
- normal simultaneous sessions on multiple devices;
- reset-password revocation of old sessions.

Do not implement phone login, social login, magic links as the primary login, MFA,
organization accounts, roles, a session/device management page, or a manual “sign out
all devices” control. Passwords are 8–128 characters. Authentication cookies are
`HttpOnly`, `SameSite=Lax`, and `Secure` in production.

Better Auth owns password hashing, session tokens, email-verification tokens, and
password-reset tokens. Application code must not reimplement these primitives.

## Profile and avatar rules

Registration creates a profile with:

- a random nickname such as `用户-A7K3Q2`, independent of the email address;
- a random stable `avatarSeed` used to render an internal deterministic default avatar;
- no stored default-avatar file.

Nicknames are 2–24 trimmed characters, may contain Chinese, Latin letters, and digits,
may repeat, and must not contain control characters.

Custom avatars accept JPEG, PNG, or WebP input up to 5 MB. SVG, GIF, and format/extension
mismatches are rejected. Sharp removes metadata, crops to a square, and writes a
256×256 WebP. The storage key is server-generated. A new file is committed before the
old file is deleted; deleting a custom avatar restores the generated default.

Avatar access is behind an `AvatarStorage` interface. The first implementation uses a
persistent local directory on the single server. Object storage is not part of this
phase, but the interface must allow it later without changing profile services.

## Data model

Better Auth supplies its required user, session, account, and verification tables. The
application adds three logical tables.

### `user_profiles`

```text
user_id primary key and foreign key
nickname
avatar_seed
avatar_key nullable
created_at
updated_at
```

### `analysis_history`

```text
id UUID primary key
user_id foreign key and indexed
schema_version
title
problem
source_code
user_thought
failure_input
expected_output
actual_output
validated_result_json JSONB
created_at indexed with user_id
```

Only schema-valid successful analyses are inserted. History stores the user inputs
needed to reopen a result and the validated structured result. It never stores the
DeepSeek API key, Authorization header, constructed prompt, raw upstream body, or
invalid model response. User deletion of one history item is a hard delete.

### `daily_user_activity`

```text
user_id foreign key
activity_date
successful_analysis_count
last_active_at
primary key (user_id, activity_date)
```

This aggregate table replaces a general event stream. Registration totals come from
the user table; successful-analysis totals also remain derivable from history. Do not
store page views, pointer activity, code contents as analytics, advertising identifiers,
or local-edition activity.

## Analysis flow and persistence behavior

```text
parse and validate request
→ resolve local browser identity or verified hosted user
→ apply one-in-flight and three-per-minute guard
→ call DeepSeek with the user-supplied key
→ parse and validate the structured result
→ hosted: insert history and upsert daily activity
→ return the validated result
```

The existing analysis route is too large to absorb authentication and persistence. It
must be split without changing the frozen `mvp-1` result schema or current retry rules.
Local mode keeps anonymous browser-session protection. Hosted mode keys protection by
authenticated user ID.

A valid model result remains useful even if history persistence fails. The API returns
the result with `historySaved: false` and a non-sensitive warning after one bounded
save retry. It does not silently claim that history exists, and it never re-calls the
model merely because the database write failed. Model failures create no history row.

## History interface

Hosted users receive:

- a newest-first list with a default page size of 20 and maximum of 50;
- one detail containing saved inputs and validated output;
- permanent deletion of one owned item.

There is no history editing, recovery bin, folders, tags, full-text search, public share
link, or unlimited-history promise. A request for another user’s history returns 404 to
avoid confirming that the identifier exists.

## Usage reporting

The first backend produces server-side JSON and CSV reports for:

- total registered users;
- verified users;
- daily, weekly, and monthly active users;
- total successful analyses;
- successful analyses per active user;
- users active again within seven days of registration.

The first phase provides command-line reporting, not a large admin dashboard. Reports
contain aggregates and no user code, API keys, prompts, or raw event trails.

## Error and logging policy

Application APIs retain the existing `{ success, data | error }` envelope and stable
machine-readable codes. Use 400 for invalid input, 401 for missing authentication, 403
for unverified or unauthorized state, 404 for disabled/missing/unowned resources, 409
for an in-progress analysis, 413 for an oversized avatar, 429 for rate limiting, 502 for
upstream model failures, and 504 for model timeout.

Logs may contain a generated request ID, error code, duration, and safe database error
category. Logs must not contain passwords, cookies, verification/reset tokens, API keys,
problem text, source code, user thoughts, constructed prompts, model bodies, or full
history rows.

## Reproducibility requirements

- A local-edition clone runs with Node.js 24 LTS, `npm ci`, `.env.local`, and no Docker.
- Hosted development starts PostgreSQL and Mailpit from one version-pinned Compose file.
- Environment examples explain every required variable without containing secrets.
- Every schema change is a committed migration; production never relies on ORM `push`.
- Development, integration tests, and production use the same PostgreSQL major version.
- The application package and lockfile are the dependency authority.
- Documentation contains a fresh-clone procedure and a recovery procedure.

## Testing strategy

Continue test-driven development with the existing Node test runner and `tsx`.

- Unit tests cover edition capabilities, validation, nickname generation, avatar rules,
  services, and error mapping.
- Integration tests run migrations against a disposable PostgreSQL database and cover
  authentication hooks, repositories, ownership, and aggregate queries.
- Route tests cover HTTP status, response contracts, cookies, and disabled local routes.
- Security tests prove user A cannot read, update, or delete user B’s data and prove
  secrets do not enter persistence or logs.
- Mode tests prove the local edition never initializes database, SMTP, auth, profile,
  history, or metrics infrastructure.
- The full gate is `npm test`, `npm run lint`, and `npm run build` in both editions.

## Explicitly out of scope

- Final visual design or responsive polish of authentication and history pages.
- Refinement of model feedback, explanations, correction format, or response limits.
- Phone, social, MFA, organizations, billing, subscriptions, sponsorship, community, or
  commercialization features.
- General admin panel, device manager, “sign out all devices” UI, queues, Redis,
  microservices, Kubernetes, multi-region deployment, or high availability.
- Running or judging user code.
- Cloud deployment, domain configuration, ICP filing, and production SMTP activation.

Minimal unpolished screens may be added only when needed to complete a local end-to-end
backend acceptance flow. Product UI work begins after the backend gate.

## Backend completion gate

The backend is complete only when:

1. The local edition still runs without Docker, database, account, history, or telemetry.
2. Hosted development starts from documented commands on a clean machine.
3. Registration, verification, login, current-device logout, and password reset pass.
4. Default and custom profile behavior pass, including safe avatar replacement.
5. Hosted successful analyses save automatically; failures do not create history.
6. Users can list, reopen, and delete only their own history.
7. Aggregate usage reports export as JSON and CSV without sensitive contents.
8. Restarting containers preserves database and avatar data.
9. All tests, lint, and both production builds pass.
10. No cloud deployment has been required to prove any item above.

## Design self-review

- No placeholder or unresolved product behavior remains.
- The local-edition privacy promise is compatible with the shared repository.
- The stack matches the existing Next.js and TypeScript architecture.
- Every stored field has a stated product purpose.
- The scope fits one modular monolith and is decomposed into independently testable
  implementation tasks in the accompanying plan.
