# Stock console

An internal console for a supplies team to search, filter, sort and inspect stock, and to correct a stock count when a physical count disagrees with the system. Built for ward tablets on patchy wifi, with shareable links to single items.

|                  |                                                                      |
| ---------------- | -------------------------------------------------------------------- |
| **Live app**     | https://stock-console-gamma.vercel.app                               |
| **Repository**   | https://github.com/geekycodess/stock-console                         |
| **Deploys from** | `main`, automatically on merge                                       |
| **Stack**        | React 18, TypeScript, Vite, React Router 7, TanStack Query 5, Vitest |
| **Data source**  | [DummyJSON](https://dummyjson.com/docs), used as the stock catalogue |
| **Time spent**   | 40 hours                                                             |

Sign in with any [DummyJSON user](https://dummyjson.com/users), for example `emilys` / `emilyspass`.

## Contents

1. [Overview](#overview)
2. [Getting started](#getting-started)
3. [Section 1: Design and decision log](#section-1-design-and-decision-log)
4. [Section 2: Build](#section-2-build)
5. [Section 3: Deployment and CI/CD](#section-3-deployment-and-cicd)
6. [Known limitations](#known-limitations)
7. [AI use declaration](#ai-use-declaration)
8. [Section 4: AI reflection](#section-4-ai-reflection)

## Overview

- **Sign in** with a short-lived token that refreshes itself.
- **Stock list** of 194 items, 20 per page, with search, category filter and sort. Each row shows image, name, SKU, category, price and a stock badge.
- **Item detail** at `/items/:id`. A pasted link works for a colleague: they sign in, then land on the same item.
- **Stock correction** from the item detail, with clear saving, success and failure states.
- **Resilience:** loading, empty and error states with recovery, retries, and an offline banner.

### Brief requirements

| Requirement                                          | How it is met                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R1 Search never shows a replaced query               | Debounced input, query in the cache key, requests aborted, no previous data kept while loading |
| R2 Filter or sort never strands you on an empty page | Any change resets to page 1; an out-of-range page is clamped to the last page                  |
| R3 Reload or a copied URL restores the view          | Search, category, sort and page live in the URL                                                |
| R4 Loading, empty and error states with recovery     | On every data screen, with "Try again". Tested against `/http/500`                             |
| R5 Keyboard only, readable at 360px                  | Native controls, skip link, managed focus, 44px targets, table becomes cards below 720px       |
| Token expiry without losing your place               | Proactive and reactive refresh; a rejected refresh goes to login and back to the same URL      |

## Getting started

Requires Node.js 20 or newer (`.nvmrc` pins 20).

```bash
npm install     # also installs the git hooks
npm run dev     # http://localhost:5173
```

| Script                 | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server                                             |
| `npm run build`        | Typecheck, then production build into `dist/`          |
| `npm run preview`      | Serve the production build locally                     |
| `npm test`             | Unit tests (Vitest, jsdom)                             |
| `npm run typecheck`    | TypeScript, no emit                                    |
| `npm run lint`         | ESLint                                                 |
| `npm run format`       | Prettier, write                                        |
| `npm run format:check` | Prettier, check only. Fails when files are unformatted |

### Environment variables

Optional. Copy `.env.example` to `.env.local` and restart the dev server.

| Variable           | Applies to   | Effect                                                            |
| ------------------ | ------------ | ----------------------------------------------------------------- |
| `VITE_API_DELAY`   | dev only     | Adds `?delay=N` (0 to 5000 ms) to requests to test slow networks  |
| `VITE_FORCE_ERROR` | dev only     | Sends `/products` calls to `/http/<code>` to test error states    |
| `VITE_TOKEN_MINS`  | dev and prod | Token lifetime requested at login. Default `1`, as the brief asks |

The two testing flags are guarded by `import.meta.env.DEV`, so they cannot affect a production build. Do not set `VITE_TOKEN_MINS` on the host.

## Section 1: Design and decision log

The design starts from three facts in the brief: the users are on ward tablets over patchy wifi, they share links to single items, and the app will roll out to more sites. Every choice below follows from one of them.

### 1. Components and screen layout

The app has three routes and one shell.

- **Shell:** app bar, skip link, offline banner and the content area. Every signed-in screen renders inside it.
- **ListPage:** a controls card (search, category, sort), a results bar, the stock table and the pager. The table becomes stacked cards below 720px.
- **DetailPage:** the item summary card and a separate correction form card.
- **LoginPage:** a single centred card.
- **Shared pieces:** `States` (loading skeletons, empty and error cards), `StockBadge`, `OfflineBanner` and a root `ErrorBoundary`.

Pages own their data fetching. `api/` has no React in it and `lib/` holds pure functions, so the logic that is easy to get wrong can be unit tested without rendering anything.

### 2. Where state lives, and why

| State                          | Where                    | Why there and not elsewhere                                                          |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------ |
| Product list, categories, item | TanStack Query           | It is server data: it needs caching, cancellation, retries and invalidation          |
| Search, category, sort, page   | URL query string         | Reload and shared links must restore the view, and the back button should work       |
| Text being typed in the search | Local `useState`         | Writing every keystroke to the URL would fire a request per key and flood history    |
| Stock form value, focus flags  | Local state / refs       | Nobody else needs them, and they should not survive navigation                       |
| Tokens and the user            | `localStorage` + context | A reload must keep the session; React state alone would sign everyone out on refresh |

The three kinds of state are kept apart on purpose. The URL says what the user is looking at, the cache says what the server returned for it, and local state is only the half-finished input.

### 3. Fetching, caching and invalidation

- Query keys are `['products','list',params]`, `['products','detail',id]` and `['categories']`. Search text is committed to the URL after a 300 ms pause.
- Every query key contains its parameters, so each search, filter, sort and page has its own cache entry. Switching back to a page seen in the last 60 seconds is instant.
- Requests receive an `AbortSignal`. When the user changes the query, the old request is cancelled and its result can never land on screen.
- Network errors and 5xx are retried twice with a short backoff, so a flaky tablet recovers without the user doing anything. A 4xx is never retried, because a missing item will not appear on a second try.
- After a successful save, the item's cache entry is updated with the server response and all list queries are invalidated, so the new count shows when the user goes back to the list.
- Categories are fetched once per session, because they do not change while someone is working.
- Refetch on reconnect is on, so lists recover by themselves when the connection returns.

### 4. Layout, spacing, colour and typography

No component library. All styling is hand-written CSS driven by design tokens (custom properties for colour, spacing, radius and shadow), so a rebrand for another site is a change in one block.

- **Type:** the system font stack. A web font would cost a download on every cold start over poor wifi, for no benefit in an internal tool.
- **Colour:** a deep teal accent on a soft neutral background. Text and badge pairs meet 4.5:1 contrast, and stock state is written out as well as coloured.
- **Layout:** one column on phones, a table on wider screens, because supplies staff compare prices and counts and aligned columns are quicker to scan. Numbers use tabular figures so digits line up.
- **Touch:** 44px minimum target size, and hover styling only on devices that can hover.

### 5. Accessibility approach

- **Keyboard:** native controls everywhere. Each row has one link, stretched with CSS so the whole row is clickable without adding extra tab stops. The skip link is the first tab stop.
- **Focus management:** focus moves to the content area only on real route changes, never on first load, which would skip the skip link. After paging, focus moves to the first item. While the next page loads it sits on the loading message, because the Next button has disappeared.
- **Announcements:** `role="status"` for loading and result counts, `role="alert"` for errors.
- **Not colour alone:** badges say "Low: 4 left" or "Out of stock", and forced-colours mode adds a border.
- **Motion:** shimmer and transitions are switched off under `prefers-reduced-motion`.
- **Enforcement:** `eslint-plugin-jsx-a11y` runs in lint and CI.

### Decision log

| #   | Decision                                                                                        | Alternative rejected                                                                | Why                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Keep list state (search, category, sort, page) in the URL                                       | Component state or context, optionally mirrored to `sessionStorage`                 | The brief needs reload and pasted links to restore the view. The URL does that for free and also fixes the back button. The cost is that the URL is untrusted input, so one `parseParams` function validates it and falls back to defaults.                           |
| 2   | No `keepPreviousData`: show a skeleton while a new query loads                                  | Keep the old rows on screen, dimmed, until the new ones arrive (smoother)           | Requirement R1 says the user must never look at results for a query they have replaced. On slow wifi, old rows look current. I accepted a short loading state, and cached pages and a layout-matching skeleton soften it.                                             |
| 3   | Pessimistic stock save: wait for the server before showing the new count                        | Optimistic update with rollback on failure                                          | Stock counts are records. An unconfirmed number that later rolls back is worse than a short wait, especially when wifi drops mid-save. On failure the typed value stays so the user can retry without retyping.                                                       |
| 4   | Overlay confirmed corrections from `localStorage` on top of API reads                           | Trust the server response, or keep the new value only in the query cache            | DummyJSON accepts the PUT but does not persist it, so the count would snap back after any refetch or reload and the feature would look broken. The overlay is written only after a confirmed success. The trade-off, that corrections are per browser, is documented. |
| 5   | If the token refresh fails because of the network or a 5xx, keep the session                    | Sign the user out on any refresh failure (simpler)                                  | Ward wifi drops constantly. Signing out loses the user's place and anything they typed. Only a 4xx from the refresh endpoint means the session is truly over. The cost is that a user may sit on an error screen until they press Try again.                          |
| 6   | Combine search and category on the client: fetch all matches (`limit=0`), filter, then paginate | Ignore the category while searching, or make the UI search within one category only | The API cannot combine them, and ignoring a filter the user set would be a silent bug. The catalogue is 194 items, so fetching all matches is small. It would not scale, and a real backend should filter server-side.                                                |
| 7   | Table on wide screens, cards on phones, from one set of markup                                  | Cards everywhere, or a table with horizontal scrolling                              | The team compares numbers, which a table shows best. Horizontal scrolling would break the 360px requirement. Table roles are set explicitly so screen readers keep the structure after the CSS reshapes the rows.                                                     |
| 8   | Store tokens in `localStorage`                                                                  | Memory only, or an HttpOnly cookie                                                  | Memory only would sign everyone out on every reload, which fails R3. An HttpOnly cookie is safer but needs a backend that DummyJSON does not provide. This is the weakest point of the design and is listed under known limitations.                                  |

## Section 2: Build

### Project structure

```
src/
  main.tsx              Bootstrap: error boundary, router, QueryClient (retry policy)
  App.tsx               Routes and auth guard
  api/
    http.ts             fetch wrapper: auth header, token refresh, ApiError, dev flags
    products.ts         list, categories, detail, stock update (with local overlay)
  auth/
    AuthContext.tsx     Session state, login/logout, proactive refresh timer
    tokens.ts           Token storage and JWT expiry parsing
  lib/
    listParams.ts       URL <-> list state: parse, serialise, clamp page
    retry.ts            Which errors are worth retrying
    format.ts           Stock level, price and category label helpers
  pages/                LoginPage, ListPage, DetailPage
  components/           Shell, States, StockBadge, OfflineBanner, ErrorBoundary, Logo
  styles.css            Design tokens and all styling
public/                 Favicon and robots.txt
```

`api/` knows nothing about React. `lib/` holds the pure logic, which is where the tests concentrate.

### Authentication and token handling

- Tokens are stored under `sc.tokens`. `/auth/me` restores the session on load.
- **Proactive refresh:** a timer refreshes about 10 s before expiry.
- **Reactive refresh:** a 401 triggers one refresh, shared by concurrent requests, then one retry.
- **In practice:** DummyJSON's `/products` endpoints accept an expired token (see Mock API limitations), so against this API the proactive timer is what keeps a session alive while paging. The reactive path is exercised by `/auth/me` and the unit tests.
- **Refresh rejected (4xx):** tokens are cleared and the user goes to `/login`, then returns to the same path and query.
- **Refresh unreachable (network or 5xx):** the session is kept and the request shows its error state. A dropped connection should not sign anyone out.

### Stock correction

1. Whole numbers from 0 to 1,000,000 only. Anything else shows a message and sends no request.
2. On save the button is disabled and reads "Saving…".
3. **Success:** confirmation, and the shown stock updates.
4. **Failure:** an error message, the typed value is kept, and the user can retry.

The save is pessimistic: the UI never shows a count the server has not confirmed.

### Screen states

| Screen     | Loading             | Empty                               | Error                           |
| ---------- | ------------------- | ----------------------------------- | ------------------------------- |
| List       | Skeleton rows       | "No items match" and a clear button | Alert with "Try again"          |
| Categories | Filter stays usable | n/a                                 | Inline alert with "Retry"       |
| Detail     | Skeleton card       | Not-found state with a link back    | Alert with "Try again"          |
| Sign in    | "Signing in…"       | n/a                                 | Credentials or connection error |

### Mock API limitations

- **`PUT /products/{id}` does not persist.** Confirmed corrections are stored in `localStorage` (`sc.stockOverrides`) and overlaid on reads. A failed save records nothing. Server-side sorting by stock ignores these overrides.
- **Search cannot be combined with a category.** With both set, the app fetches all matches (`limit=0`), filters by category on the client, then paginates. The page count follows the filtered total.
- **Corrections are per browser,** not shared between colleagues. A real backend would own this.
- **Token enforcement is looser than a real API.** In my tests only `/auth/me` rejected an expired access token. `/products` answered 200 either way, and `/auth/refresh` ignored the expired access token and checked only the refresh token. So the 401-then-refresh path is exercised by the unit tests (`src/api/http.test.ts`) and by `/auth/me`, not by stock requests.

### Testing

`npm test` runs the unit tests, which target logic that is easy to get wrong:

| File                                    | Protects                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/api/http.test.ts`                  | Concurrent 401s share one refresh; rejected refresh clears the session once; network failure keeps it |
| `src/api/products.test.ts`              | Search plus category filtering and pagination; stock overlay only after a successful save             |
| `src/lib/listParams.test.ts`            | URL parsing, serialising and page clamping                                                            |
| `src/lib/retry.test.ts`                 | 5xx and network are retried, 4xx are not                                                              |
| `src/lib/format.test.ts`                | Stock level boundaries and labels                                                                     |
| `src/auth/tokens.test.ts`               | JWT expiry parsing                                                                                    |
| `src/components/ErrorBoundary.test.tsx` | A render crash shows the recovery screen                                                              |

#### Manual checks

Put the flags in `.env.local` and restart `npm run dev`.

1. **R1:** set `VITE_API_DELAY=2000`, type a query, change it mid-request. Only the latest query's results ever show.
2. **R2:** go to page 3, change category or sort: you land on page 1 with results. Open `/?page=99`: you land on the last page.
3. **R3:** set search, category, sort and page, then reload or open the URL in a private window.
4. **R4:** set `VITE_FORCE_ERROR=500` and reload. The list and item pages reach an error state with "Try again" after one to two seconds.
5. **R5:** use only the keyboard: Tab to a row, Enter, edit the count, Enter to save. Then check 360px width in device mode.
6. **Token expiry:** stay signed in over a minute and keep paging. No redirect or blank screen should appear.

### Code quality and tooling

- **Prettier** (`.prettierrc`). `format:check` fails on unformatted files.
- **ESLint** (flat config): recommended sets for JS, TypeScript and `jsx-a11y`, plus chosen rules: hooks rules as errors, no `any`, consistent type imports, `eqeqeq`, `no-console` (only `console.error`). No rules are disabled.
- **Conventional Commits** enforced by **commitlint** on a **husky** `commit-msg` hook, so bad messages are rejected locally.
- **`.editorconfig`** and **`.gitattributes`** (LF line endings) keep files stable across editors and operating systems.
- Formatting changes go in their own `style:` commits, not feature commits.
- Strict TypeScript, checked in CI and in `npm run build`.

## Section 3: Deployment and CI/CD

**Host:** Vercel. **Deploy branch:** `main`.

| Workflow     | Trigger                | Steps                                                                                   |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| `ci.yml`     | every pull request     | install, format check, lint, typecheck, tests, build, commitlint on the PR's commits    |
| `deploy.yml` | push (merge) to `main` | install, tests, `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod` |

**Merge blockers:** the `checks` job is a required status check on `main`, and merging needs a pull request. A failing format check, lint, typecheck, test, build or commit message blocks the merge.

**Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are stored as repository secrets.

**Production hardening** (`vercel.json`):

- Content-Security-Policy allowing the app's own code and API calls only to `dummyjson.com`, plus `nosniff`, no-referrer, HSTS, `X-Frame-Options` and a locked-down Permissions-Policy. If the API host changes, update `connect-src`.
- Hashed `/assets` cached for a year; `index.html` is `no-cache`.
- Every path rewrites to `index.html`, so pasted `/items/:id` links work on a fresh load.
- A root error boundary shows a recovery screen instead of a blank page.
- `noindex` and `robots.txt`, since the console is internal.
- Workflows use least-privilege permissions and timeouts, and deploys run one at a time. Dependabot opens weekly update PRs.

## Known limitations

- Stock corrections are stored per browser. A real deployment needs a server-side write.
- Tokens are in `localStorage`. Production should prefer an HttpOnly cookie session from a backend.
- Overrides are one global key, not scoped per site, so a multi-site rollout would need scoping.
- A forced sign-out loses text typed into the stock form.
- Not attempted: bulk correction and virtualised scrolling (both optional in the brief).

## AI use declaration

I used Claude by Anthropic, chat interface. I did not use any other AI tool.

| Section                    | What AI was used for                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Design and decision log | I wrote the first draft of the design and decision log myself. I then used Claude to challenge each rejected alternative. I read every row and can explain what breaks without it.                              |
| 2. Build                   | Audited the code against requirements R1 to R5 and the tooling list, then fixed the gaps: token refresh, retry policy, focus handling, UI redesign, extra tests, error boundary. Checked in a headless browser. |
| 3. Deployment and CI/CD    | Drafted the two workflows and the security headers, and helped debug git and CI problems. I created the Vercel project, the secrets, branch protection and the pull requests, and ran the pipeline myself.      |
| 4. Reflection              | I wrote the first draft myself. Claude later reworked the wording to fit the project and shortened it.                                                                                                          |

**Real time spent:** 40 hours

## Section 4: AI reflection

1. **What did I use AI for, per section?** I used Claude as a pair programmer. In Section 1 I wrote the draft myself and used it to challenge my rejected options. In Section 2 it drafted the screens, API calls and tests, and I read, ran and fixed them. In Section 3 it drafted the workflows and security headers, and I set up Vercel, the secrets and branch protection myself.

2. **Which tools and workflow?** Only Claude, in a chat window. I worked in small steps: ask for one piece, run it, fix it, then commit it. Every pull request had to pass the format check, lint, typecheck, tests and build before I merged it.

3. **A suggestion that improved my work.** Claude suggested keeping the search, category, sort and page in the URL instead of component state. I was going to use state at first, but state alone cannot restore the view after a reload or a pasted link, which the brief requires. The URL does that, and it also fixes the back button.

4. **AI output that was wrong, and how I caught it.** The generated login form had test credentials pre-filled in, so I removed them in a follow-up pull request. I also found that `.gitignore` was hiding `.env.example`, so it was never committed, yet every check passed. Green CI only proves what it tests. I caught it by comparing my folder with what was in git.

5. **Two decisions I made without AI.** First, the stock form only saves after the server replies, instead of updating the screen straight away. A wrong stock count is worse than a slow save. Second, the test switches for slow networks and forced errors only work in development, so they can never affect the live site.

6. **The part I would struggle to defend.** The stock correction. The demo API accepts an update but does not keep it, so I save the new number in the browser. It only works on that one device, and another tablet would still show the old number. It is listed under known limitations, and a proper fix needs a real backend.
