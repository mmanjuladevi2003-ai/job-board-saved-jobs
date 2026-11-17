# Job board with saved jobs

A small, fictional internship job board for the insiderOne work sample. Jobs and companies are made up; no real personal information is used.

## Run it

Requires **Node.js 20 or newer**. No dependencies or installation step required.

```sh
npm start    # open http://localhost:3000
npm test     # run all original and new tests with Node's built-in test runner
```

## What I built

- A **Save** button beside every job, with a disabled **Saved ✓** state after saving.
- A **Saved jobs** section on the same page, including the total count and **Remove** controls.
- Saves remain after a page reload (and after the server restarts) using `saved-jobs.json`.
- Clear empty states, responsive layout, search, and user-facing error messages.
- No frameworks, databases, npm packages, or real user data.

### API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/api/jobs?q=remote` | Search the original jobs list. |
| `GET` | `/api/saved` | List saved jobs with full details. |
| `POST` | `/api/saved` | Save a job with JSON body `{ "jobId": "j1" }`. Returns `201` if new, `200` if already saved. |
| `DELETE` | `/api/saved/j1` | Remove a saved job; returns `200` or `404` if it was not saved. |

An unknown job ID returns `404` with `{ "error": "Unknown job id" }`. An absent/invalid `jobId` or malformed JSON returns `400`. An unsaved ID on DELETE returns `404`.

## Design decision

I store **only job IDs** in `saved-jobs.json`, rather than duplicating job details. `GET /api/saved` joins those IDs with `jobs.json`, so job information has one source of truth. Writes are queued in-process and committed by renaming a temporary JSON file, avoiding lost updates from overlapping requests and incomplete JSON files if a write is interrupted. This is deliberately designed for the starter's single Node server process, not multiple server instances.

## Tests

`npm test` runs the original tests plus API integration tests covering saving, listing, duplicate saves, validation errors, deleting, JSON persistence, concurrent requests, and unchanged job search. Tests use a temporary directory and ephemeral HTTP port, so they never modify your real saved jobs.

## Files

- `server.js` — HTTP server and API endpoints.
- `lib/jobs.js` — original job loading/search helpers.
- `lib/saved.js` — JSON-file persistence and serialized updates.
- `jobs.json` — fictional job catalog.
- `saved-jobs.json` — saved IDs (`[]` initially).
- `public/index.html`, `public/app.js` — responsive page and save/remove behavior.
- `test/` — built-in Node test runner tests.

## What I would do next

For a deployed multi-user version, I would add user accounts and per-user saved jobs in a database. The current JSON file intentionally provides a **shared list** for this small single-server work sample.

## Tool use

## Tool Use

I used ChatGPT as an AI coding assistant during development, including help with implementation, debugging, and clarifying technical questions. I ran the application locally, verified the automated tests, and manually tested the core functionality to ensure everything worked as expected.