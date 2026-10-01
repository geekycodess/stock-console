# Stock console

An internal console for a supplies team to search, filter, sort and inspect stock, and to correct a stock count when a physical count disagrees with the system. Built for ward tablets on patchy wifi, with shareable links to individual items.

|                  |                                                                         |
| ---------------- | ----------------------------------------------------------------------- |
| **Live app**     | _TODO: add the deployed URL_                                            |
| **Repository**   | _TODO: add the repository URL_                                          |
| **Deploys from** | `main` (automatically, on merge)                                        |
| **Stack**        | React 18, TypeScript, Vite, React Router 7, TanStack Query 5, Vitest    |
| **Data source**  | [DummyJSON](https://dummyjson.com/docs), treated as the stock catalogue |
| **Time spent**   | _TODO: your real number, not rounded down_                              |

## Contents

1. [What it does](#what-it-does)
2. [Requirements traceability](#requirements-traceability)
3. [Getting started](#getting-started)
4. [Project structure](#project-structure)
5. [How it works](#how-it-works)
6. [Mock API limitations](#mock-api-limitations)
7. [Layout, colour and accessibility](#layout-colour-and-accessibility)
8. [Testing](#testing)
9. [Code quality and tooling](#code-quality-and-tooling)
10. [CI/CD and deployment](#cicd-and-deployment)
11. [Known limitations](#known-limitations)
12. [Section 1: Design and decision log](#section-1-design-and-decision-log)
13. [AI use declaration](#ai-use-declaration)
14. [Section 4: AI reflection](#section-4-ai-reflection)

## What it does

- **Sign in** with a DummyJSON account (`emilys` / `emilyspass`). Stock is only visible when signed in.
- **Stock list**: 194 items, 20 per page, with search, category filter, sort and pagination. Each row shows a thumbnail, name, SKU, category, unit price and a stock badge (in stock, low, out of stock).
- **Item detail** at `/items/:id`. A link pasted into chat opens the same item for a colleague, who signs in first if needed and then lands on it.
- **Stock correction** from the item detail: set a new count, save, and see the result or the failure.
- **Resilience for bad wifi**: loading, empty and error states with recovery on every data screen, automatic retries, silent token refresh, and an offline banner.

## Requirements traceability

How each requirement in the assessment brief is met, and where to look.

| Requirement                                                          | How it is met                                                                                                                                                                                    | Where                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Sign in with `expiresInMins: 1`, survive expiry without losing place | Login requests a 1-minute token. A timer refreshes it shortly before expiry, and a 401 triggers one shared refresh and a retry. A rejected refresh goes to `/login` and returns to the same URL. | `src/api/http.ts`, `src/auth/AuthContext.tsx`     |
| Paginated list, category filter, sort, search                        | Server-side paging, sorting and category. Search plus category is combined on the client because the API cannot do both (see [limitations](#mock-api-limitations)).                              | `src/api/products.ts`, `src/pages/ListPage.tsx`   |
| Dedicated item route                                                 | `/items/:id`, with an SPA rewrite in `vercel.json` so deep links work on the deployed site.                                                                                                      | `src/App.tsx`, `vercel.json`                      |
| Stock correction with defined UI states                              | Pessimistic save: the button is disabled and reads "Saving…" until the server answers. The entry is kept on failure, with an error and a way to retry.                                           | `src/pages/DetailPage.tsx`                        |
| **R1** Never show results for a replaced query                       | Debounced search, the query is part of the cache key, in-flight requests are aborted, and previous data is deliberately not kept while loading.                                                  | `src/pages/ListPage.tsx`                          |
| **R2** Filter or sort never strands you on an empty page             | Any filter or sort change resets to page 1, and an out-of-range page in the URL is clamped to the last page.                                                                                     | `src/lib/listParams.ts`, `src/pages/ListPage.tsx` |
| **R3** Reload or a copied URL restores the view                      | Search, category, sort and page live in the URL query string, and defaults are omitted to keep links short.                                                                                      | `src/lib/listParams.ts`                           |
| **R4** Loading, empty and error states, with recovery                | Every data screen has all three. Errors offer "Try again". Tested against `/http/500`.                                                                                                           | `src/components/States.tsx`                       |
| **R5** Keyboard-only use, readable at 360px                          | Native controls, one link per row, skip link, managed focus, 44px targets, and a table that becomes cards below 720px.                                                                           | `src/components/Shell.tsx`, `src/styles.css`      |
| Formatter, linter, commitlint, editorconfig                          | Prettier, ESLint with a chosen ruleset, commitlint on a husky `commit-msg` hook, `.editorconfig`.                                                                                                | repo root                                         |
| CI that can fail a PR, auto-deploy on merge                          | GitHub Actions: `ci.yml` on pull requests and `deploy.yml` on pushes to `main`.                                                                                                                  | `.github/workflows/`                              |

## Getting started

**Prerequisites:** Node.js 20 or newer (`.nvmrc` pins 20, so `nvm use` works) and npm.

```bash
npm install          # also installs the git hooks via husky
npm run dev          # http://localhost:5173
```

Sign in with  `emilys` / `emilyspass`, or any user from [dummyjson.com/users](https://dummyjson.com/users).

### Scripts

| Script                 | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Start the dev server                                         |
| `npm run build`        | Typecheck, then build for production into `dist/`            |
| `npm run preview`      | Serve the production build locally                           |
| `npm test`             | Run the unit tests once (Vitest, jsdom)                      |
| `npm run typecheck`    | TypeScript with no emit                                      |
| `npm run lint`         | ESLint                                                       |
| `npm run format`       | Prettier, write                                              |
| `npm run format:check` | Prettier, check only. Fails on unformatted files, used in CI |

### Environment variables

Copy `.env.example` to `.env.local` to use these. They are optional and read at build or dev-server start.

| Variable           | Applies to   | Effect                                                                                  |
| ------------------ | ------------ | --------------------------------------------------------------------------------------- |
| `VITE_API_DELAY`   | dev only     | Adds `?delay=N` (0 to 5000 ms) to every request, to test loading states and slow search |
| `VITE_FORCE_ERROR` | dev only     | Sends `/products` requests to `/http/<code>` to test error states (for example `500`)   |
| `VITE_TOKEN_MINS`  | dev and prod | Access-token lifetime requested at login. Defaults to `1`, as the brief asks            |

The two testing flags are guarded by `import.meta.env.DEV`, so they cannot affect a production build. **Do not set `VITE_TOKEN_MINS` on the hosting provider**: it applies in production and would change the session length.

## Project structure

```
src/
  main.tsx              App bootstrap: QueryClient (retry policy) and router
  App.tsx               Routes and the auth guard
  api/
    http.ts             fetch wrapper: auth header, token refresh, error type, dev flags
    products.ts         list, categories, detail, stock update (with local overlay)
  auth/
    AuthContext.tsx     Session state, login/logout, proactive refresh timer
    tokens.ts           Token storage and JWT expiry parsing
  lib/
    listParams.ts       URL <-> list state: parse, serialise, clamp page
    retry.ts            Which errors are worth retrying
    format.ts           Stock level, price and category label helpers
  pages/                LoginPage, ListPage, DetailPage
  components/           Shell, States (loading/empty/error), StockBadge, OfflineBanner, ErrorBoundary, Logo
public/                 Favicon and robots.txt
  styles.css            Design tokens and all styling
  test/memoryStorage.ts In-memory localStorage for tests
```

Pages own their data fetching. `api/` knows nothing about React. `lib/` holds the pure logic, which is where the unit tests concentrate.

## How it works

### State: where each kind lives

| Kind               | Examples                                                               | Lives in                          |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------- |
| Server data        | Product list, categories, one product                                  | TanStack Query cache              |
| Shareable UI state | Search text, category, sort, page                                      | URL query string                  |
| Local UI state     | Text in the search box before it is committed, form input, focus flags | React `useState` / `useRef`       |
| Session            | Access and refresh tokens, current user                                | `localStorage` plus `AuthContext` |

The URL is the source of truth for the list view. `parseParams` treats it as untrusted input: unknown sort keys and invalid pages fall back to defaults.

### Fetching, caching and invalidation

- **Query keys:** `['products','list', params]`, `['products','detail', id]`, `['categories']`.
- **Freshness:** list and detail are fresh for 60 seconds. Categories never go stale in a session.
- **Search:** the input keeps local text and commits it to the URL after a 300 ms pause. Requests receive an `AbortSignal`, so a replaced query is cancelled. `keepPreviousData` is **not** used, so the screen shows a loading state rather than results for an old query.
- **Retries:** network errors and 5xx are retried twice with a short backoff (500 ms, then 1 s). 4xx errors are never retried, because a missing item will not fix itself. Saves are never retried automatically.
- **After a successful save:** the detail cache is updated with the server's response, and all list queries are invalidated so the new count shows when the user goes back.
- **Refetch on reconnect** is left on, so lists recover by themselves when the connection returns.

### Stock correction

1. The user enters a whole number from 0 to 1,000,000. Anything else shows an inline message and sends no request.
2. On save, the button is disabled and reads "Saving…". The typed value stays on screen.
3. **Success:** a confirmation appears and the displayed stock updates.
4. **Failure:** an error message appears, the typed value is kept, and the button is enabled again so the user can retry.

The save is **pessimistic** on purpose: the UI never shows a count the server has not confirmed, which matters for stock records.

### Authentication and token lifetime

- Tokens are stored in `localStorage` under `sc.tokens`. On load, `/auth/me` restores the session.
- **Proactive refresh:** a timer reads the token's expiry and refreshes about 10 seconds before it (never sooner than 5 seconds out).
- **Reactive refresh:** a 401 triggers one refresh, shared by all requests that failed at the same time, then the original request is retried once.
- **Refresh rejected (4xx):** the session is over. Tokens are cleared and the user is sent to `/login`, then returned to the URL they were on (path and query) after signing in.
- **Refresh unreachable (network or 5xx):** the session is **kept**. The request shows its error state with a retry button. Signing someone out because their wifi dropped would lose their place, which is the worse failure on a ward tablet.
- **Unsigned links:** opening `/items/:id` while signed out goes to `/login` and comes back to the same item.

### Loading, empty and error states

| Screen      | Loading                        | Empty                                        | Error                                    |
| ----------- | ------------------------------ | -------------------------------------------- | ---------------------------------------- |
| Stock list  | Skeleton rows, `role="status"` | "No items match" with a clear-filters button | Alert with "Try again"                   |
| Categories  | Filter stays usable            | n/a                                          | Inline alert with "Retry"                |
| Item detail | Skeleton card                  | Not-found state with a link back             | Alert with "Try again"                   |
| Sign in     | "Signing in…" on the button    | n/a                                          | Credentials error, or a connection error |

Sign-in tells "wrong credentials" (4xx) apart from "cannot reach the server" (network or 5xx).

### Offline

A banner appears when the browser reports it is offline and disappears on reconnect.

## Mock API limitations

Limitations of DummyJSON that shaped the implementation, and what the app does about each.

- **`PUT /products/{id}` does not persist.** The server echoes the update but later reads return the original data. Confirmed corrections are stored in `localStorage` (`sc.stockOverrides`) and overlaid on list and detail reads. A failed save records nothing. Consequence: server-side sorting by stock ignores these local overrides.
- **Search cannot be combined with a category.** With both set, the app fetches every search match (`limit=0`), filters by category on the client, then paginates locally. The page count follows the filtered total.
- **Overrides are per browser.** They are not shared between colleagues or devices, because there is no real backend. In production this would be a server responsibility.
- **Token enforcement is looser than a real API.** Confirm against the live API which endpoints actually reject an expired token, since that decides where the 401 path can be observed.
- **Slow and failing responses** are simulated with `?delay=` and `/http/{code}`, and are used by the developer flags below.

## Layout, colour and accessibility

### Visual system

- **No component library.** All styling is hand-written CSS in `src/styles.css`.
- **Design tokens** are CSS custom properties on `:root`: colour palette, spacing unit, radius and shadow.
- **Typography** uses the system font stack, deliberately: no web-font download over patchy wifi. One type scale, tabular numerals in numeric columns.
- **Colour:** a teal accent on a soft neutral background. Text and badge colours are chosen for at least 4.5:1 contrast.
- **Responsive:** the stock list is a table from 720px up and becomes stacked cards below it. Filters stack into one column on narrow screens. No horizontal scrolling at 360px.

### Accessibility

- **Keyboard:** everything is a native control (`button`, `a`, `select`, `input`). Each list row has one link, and a stretched pseudo-element makes the whole row clickable without adding tab stops. A skip link is the first tab stop.
- **Focus management:** focus moves to the content area only on real route changes, not on first load. After paging, focus moves to the first item of the new page and the page scrolls to the top.
- **Focus visibility:** a 3px outline on every focusable element.
- **Do not rely on colour:** stock state is written out ("Low: 4 left", "Out of stock") as well as coloured. Forced-colours mode adds a border to badges.
- **Announcements:** loading and result counts use `role="status"`, and errors use `role="alert"`.
- **Forms:** every input has a visible label. Validation messages are text, not colour.
- **Targets:** buttons, inputs and links are at least 44px tall.
- **Motion:** skeleton shimmer and hover transitions are switched off under `prefers-reduced-motion`. Hover styling only applies on devices that can hover.
- **Linting:** `eslint-plugin-jsx-a11y` runs on every commit and in CI.

## Testing

### Automated

`npm test` runs Vitest with jsdom. The tests target logic that is easy to get wrong, not markup:

| File                                    | What it protects                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/http.test.ts`                  | Concurrent 401s share one refresh, a rejected refresh clears the session once, and a network failure keeps the session                                |
| `src/api/products.test.ts`              | Search plus category is filtered and paginated correctly, category paging uses the server, and the stock overlay applies only after a successful save |
| `src/lib/listParams.test.ts`            | URL parsing and serialising, invalid input, and page clamping                                                                                         |
| `src/lib/retry.test.ts`                 | Retry policy: 5xx and network yes, 4xx never                                                                                                          |
| `src/components/ErrorBoundary.test.tsx` | A render crash shows the recovery screen, and healthy children render untouched                                                                       |
| `src/lib/format.test.ts`                | Stock level boundaries and label formatting                                                                                                           |
| `src/auth/tokens.test.ts`               | JWT expiry parsing                                                                                                                                    |

### Manual verification of the five tested requirements

Use the developer flags. Put them in `.env.local` and restart `npm run dev`.

1. **Search never shows a replaced query.** Set `VITE_API_DELAY=2000`. Type a query, wait for the request to start, then change it. The screen shows the loading state, then results for the latest text only.
2. **Filter or sort never strands you on an empty page.** Go to page 3, then change the category or sort. You land on page 1 with results. Open `/?page=99` and you land on the last page.
3. **Reload and shared links.** Set a search, category, sort and page, then reload, or paste the URL into a private window (sign in first). The view is identical.
4. **Error state.** Set `VITE_FORCE_ERROR=500` and reload. The list, and the item page, reach an error state with "Try again" after roughly one to two seconds of retries.
5. **Keyboard and 360px.** Unplug the mouse: Tab to a row, press Enter, edit the count and press Enter to save. Then use browser device mode at 360px width and confirm nothing scrolls sideways.

**Token expiry:** stay signed in for over a minute (the default token lifetime is 1 minute). Continue paging. The session should roll over without a redirect or blank screen. To see a rejected refresh, clear the refresh token in `localStorage` and page again: you are sent to `/login` and returned to the same URL after signing in.

## Code quality and tooling

- **Prettier**: `.prettierrc` (single quotes, 90 columns, trailing commas). `npm run format:check` fails on unformatted files.
- **ESLint** (flat config): the recommended sets for JavaScript, TypeScript and `jsx-a11y`, plus rules chosen for this codebase: `react-hooks/rules-of-hooks` and `exhaustive-deps` as errors, `no-explicit-any` as an error, `consistent-type-imports`, `eqeqeq`, and `no-console` (only `console.error` allowed). No rules are disabled anywhere in the source.
- **Conventional Commits**, enforced by **commitlint** through a **husky** `commit-msg` hook, so a bad message is rejected locally and not only in CI.
- **`.editorconfig`** keeps indentation, line endings and final newlines stable across editors.
- **Formatting is kept out of feature commits.** Bulk formatting changes go in their own `style:` or `chore:` commit so feature diffs stay reviewable.
- **TypeScript** runs in strict mode and is checked in CI and as part of `npm run build`.

## CI/CD and deployment

**Hosting:** Vercel. **Deploy branch:** `main`.

| Workflow     | Trigger                | Steps                                                                                               |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `ci.yml`     | every pull request     | install, format check, ESLint, typecheck, tests, production build, commitlint over the PR's commits |
| `deploy.yml` | push (merge) to `main` | install, tests, `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod`             |

**Checks that can block a merge:** format check, lint, typecheck, tests, build and commit message check. Each is a failing exit code that fails the pull request. To make them block, mark the CI job as a **required status check** in the repository's branch protection rules for `main`.

**One-time setup:**

1. Create the project in Vercel and note the org ID and project ID.
2. Add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
3. Enable branch protection on `main` with the CI job as a required check.
4. Do not set `VITE_TOKEN_MINS`, `VITE_API_DELAY` or `VITE_FORCE_ERROR` in Vercel.

### Production hardening

- **Security headers** (`vercel.json`): a strict Content-Security-Policy (scripts and styles from the app only, API calls only to `dummyjson.com`, no framing), plus `nosniff`, `no-referrer`, HSTS, `X-Frame-Options` and a locked-down Permissions-Policy. If the API host or image host changes, update `connect-src` and `img-src`, or the app will be blocked in production.
- **Caching:** hashed files in `/assets` are cached for a year as immutable. `index.html` is `no-cache`, so a new deploy is picked up on the next load.
- **Crash screen:** a root error boundary shows a recovery screen with a reload button instead of a blank page if rendering ever fails.
- **Not indexed:** the console is internal, so it sends `noindex` and a `robots.txt` that disallows crawling.
- **Workflows:** least-privilege token permissions, job timeouts, one deploy at a time, and CI runs cancelled when a branch is pushed again. Dependabot opens weekly dependency PRs.
- **Verified:** the build was served with these exact headers and exercised in a browser (sign in, deep link, filter, save) with no CSP violations.

`vercel.json` rewrites every path to `index.html`, so a pasted `/items/:id` link works on a fresh load. Without this, deep links would return a 404 on the deployed site.

## Known limitations

- Stock corrections are stored per browser (see [Mock API limitations](#mock-api-limitations)). A real deployment needs a server-side write.
- Tokens are in `localStorage`, which is exposed to any script on the page. A production deployment should prefer an HttpOnly cookie session issued by a backend.
- Stock overrides are a single global key, not scoped per site. Rolling out to more sites would need a site scope.
- A forced sign-out (a genuinely rejected refresh) loses text typed into the stock form.
- Categories are labelled from the API's own names, but item records only carry category slugs, which are prettified client-side.
- Not attempted: bulk correction and virtualised scrolling (both optional in the brief).

---

> **The sections below are yours to write.** The brief asks for the design draft and reflection in your own words, and says a generated answer "scores nothing". Facts you can build on are listed under each heading, and the reasoning has to come from you.

## Section 1: Design and decision log

> **TODO: replace this block with your own draft.** Write it as if you were designing before the code existed.

### 1. Components and how the screen is divided

_TODO. Facts from the code to check yourself against: `Shell` (bar, skip link, offline banner), `LoginPage`, `ListPage` (controls, results bar, table, pager), `DetailPage` (`Detail`, `StockForm`), shared `States` and `StockBadge`._

### 2. Where each piece of state lives, and why

_TODO. Explain why server data, URL state and local UI state are separated, and what would break if the search text lived only in local state or only in the URL._

### 3. How data is fetched, cached and invalidated

_TODO. Cover the cache keys, freshness windows, cancellation, retries and what happens after a save._

### 4. Layout, spacing, colour and typography

_TODO. State plainly whether you used a library's defaults or your own tokens, and why the table becomes cards on phones._

### 5. Accessibility approach

_TODO. Cover keyboard use, focus management, not relying on colour, and announcements._

### Decision log

Each entry needs the decision, the alternative you rejected, and why. Generic entries score nothing, so pick the ones that were genuinely hard. Candidates that this codebase actually makes, with where to look:

| #   | Decision (TODO: your wording)                                                | Alternative you rejected (TODO) | Why (TODO) |
| --- | ---------------------------------------------------------------------------- | ------------------------------- | ---------- |
| 1   | _e.g. list state in the URL_ (`listParams.ts`)                               |                                 |            |
| 2   | _e.g. no `keepPreviousData` on the list_ (`ListPage.tsx`)                    |                                 |            |
| 3   | _e.g. pessimistic stock save_ (`DetailPage.tsx`)                             |                                 |            |
| 4   | _e.g. local overlay for the non-persisting PUT_ (`products.ts`)              |                                 |            |
| 5   | _e.g. keep the session when refresh fails from the network_ (`http.ts`)      |                                 |            |
| 6   | _e.g. client-side filtering for search plus category_ (`products.ts`)        |                                 |            |
| 7   | _e.g. table on wide screens, cards on phones_ (`ListPage.tsx`, `styles.css`) |                                 |            |

## AI use declaration

> **TODO: declare, per section, what you actually used AI for.** A few lines each is enough. Be accurate about which parts you wrote and which you generated, because the live session will ask you to explain any of it.

| Section                    | What AI was used for (TODO) |
| -------------------------- | --------------------------- |
| 1. Design and decision log |                             |
| 2. Build                   |                             |
| 3. Deployment and CI/CD    |                             |
| 4. Reflection              |                             |
| README                     |                             |

**Real time spent:** _TODO_

## Section 4: AI reflection

> **TODO: answer these yourself.** Bullets are fine. Short and specific beats long and polished. Honesty counts for more than the answer, especially question 6.

1. **What did you use AI for across the four sections?** _TODO (per section)_
2. **Which tools did you use, and how did the workflow run?** _TODO (or describe how you structured the work if you used no framework)_
3. **One example where an AI suggestion improved your work. What did you prompt it with?** _TODO_
4. **One example where AI output was wrong, incomplete or subtly bad, and how you caught it.** _TODO_
5. **Two decisions you made without AI, and why you trusted your own judgment.** _TODO_
6. **One part of the codebase you would struggle to defend, and why.** _TODO_
