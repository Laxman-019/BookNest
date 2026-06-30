# 📚 BookNest

## What the app does

BookNest is a full-stack reading-tracker where users build a personal book library, organise it into custom shelves, and collaborate with other registered users under strict role-based permissions. Owners can share a shelf as a Viewer (read-only) or Editor (can add/remove books), track reading progress with automatic "Finished" detection, lend physical books to other users with full lending-state validation, and watch everything — lending, shelf changes, shared activity — update live across browser sessions via authenticated WebSockets. A dashboard summarises reading stats and surfaces a real-time activity feed.

---

## How to run it (clean clone)

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python seed.py                    # creates two test users + sample data
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

**Important:** You must run `daphne`, not `python manage.py runserver`. `runserver` is WSGI-only and cannot perform the WebSocket handshake — the socket will fail to connect with close code 1006 if you use it.

### 2. Frontend

```bash
cd frontend
cp .env.example .env              # edit only if backend runs elsewhere
npm install
npm run dev
```

Open `http://localhost:5173`.

### Test accounts (created by `seed.py`)

| Email | Password |
|---|---|
| alice@booknest.dev | Password1 |
| bob@booknest.dev   | Password1 |

Seed data includes 4 books for Alice, 3 for Bob, two shared shelves (Bob is EDITOR on one, VIEWER on another), and one active lending (Alice → Bob).

### Testing with two accounts at once

`localStorage` is shared across all tabs of the same browser origin. Logging into two accounts in two regular tabs will cause one session to silently overwrite the other's tokens. To test real-time/multi-user features properly:
- Open one account in a normal window and the second in an **Incognito/Private window**, or
- Use two different browsers, or two separate browser profiles.

This is standard browser storage behaviour, not an application bug.

---

## Data model

```
User (custom AbstractUser, email is the login field)
  id, email (unique), username, name, password (hashed via Django's PBKDF2)

Book
  id, user (FK → User, owner)
  title, author, status [WANT_TO_READ | READING | FINISHED]
  total_pages, current_page, rating (nullable), notes
  finished_date (nullable)
  lent_to (FK → User, nullable), is_lent (bool)

Shelf
  id, name, owner (FK → User)
  books (M2M → Book, through implicit join table)
  unique_together: (name, owner)

ShelfShare                                    ← RBAC join table
  id, shelf (FK → Shelf), user (FK → User)
  role [VIEWER | EDITOR]
  unique_together: (shelf, user)

Activity
  id, user (FK → User)
  action [BOOK_ADDED | BOOK_UPDATED | BOOK_STATUS_CHANGED | BOOK_LENT |
          BOOK_RETURNED | SHELF_SHARED | COLLABORATOR_ROLE_CHANGED |
          COLLABORATOR_REMOVED]
  description, metadata (JSON), created_at
```

**Relationships:**
- **User → Book**: one-to-many. A book has exactly one owner; only the owner's `user_id` foreign key controls visibility for all book mutations.
- **Book ↔ Shelf**: many-to-many. A book can sit on multiple shelves; a shelf holds many books. Deleting a shelf only removes the M2M join rows — books are never touched. Deleting a book cascades through Django's M2M handling and removes it from every shelf automatically, with no orphaned references.
- **Shelf → ShelfShare → User**: this is the RBAC layer. `ShelfShare` is the single source of truth for "who can do what on this shelf." Every shelf-mutating endpoint queries this table directly rather than trusting any client-supplied role.
- **Book.lent_to**: a nullable FK on `Book` itself (not a separate table) plus an `is_lent` boolean. Lending never transfers `Book.user` — the borrower only ever sees the book through a filtered read-only query (`Book.objects.filter(lent_to=request.user)`), so ownership never changes hands.
- **Activity**: append-only log, always attributed to the acting user, queried newest-first for the dashboard feed and broadcast live over their personal WebSocket group at creation time.

---

## Stack choice and why

| Layer | Choice | Why |
|---|---|---|
| Backend | Django 5 + DRF | Mature ORM and migrations for a relationally-heavy domain (M2M, FKs, RBAC join table); DRF gives a clean, fast API layer without extra scaffolding |
| Real-time | Django Channels (ASGI) + Daphne | Native to Django — no separate Node/Socket.io process to deploy or keep in sync with auth state |
| Channel layer | `InMemoryChannelLayer` | Zero extra infrastructure for development; swappable for `channels_redis` in production with no application-code changes |
| Auth | DRF SimpleJWT | Access + refresh token pair, rotation, and blacklisting out of the box |
| Database | SQLite | Sufficient for this assessment's scale; zero setup friction on a clean clone |
| Frontend | React 19 + Vite | Fast HMR, minimal build config |
| Styling | Tailwind CSS v4 | Utility-first, no hand-written CSS files to maintain |
| HTTP client | Axios | Built-in interceptor hooks made the transparent-refresh flow straightforward |

---

## Refresh-token flow

**On login/signup:** the server returns `{ access, refresh }`. `access` has a 15-minute lifetime; `refresh` lasts 7 days with rotation enabled (`ROTATE_REFRESH_TOKENS=True`) and blacklisting after rotation (`BLACKLIST_AFTER_ROTATION=True`).

**Where they're stored:** both tokens go into `localStorage` (`access`, `refresh` keys) on the client. `access` is attached to every API request via an Axios request interceptor: `Authorization: Bearer <token>`.

**On expiry:** when any request returns `401`, the Axios response interceptor catches it, POSTs the stored `refresh` token to `/api/auth/refresh/` (DRF SimpleJWT's `TokenRefreshView`), stores the newly-issued `access` token, and silently retries the original request — the user never sees an interruption. If the refresh call itself fails (refresh token expired or blacklisted), tokens are cleared and the user is redirected to `/login`.

**On page reload:** `AuthContext` reads the stored `access` token on mount and calls `GET /api/auth/me/` to rehydrate the logged-in user, rather than re-requiring login on every refresh.

**On logout:** the refresh token is POSTed to `/api/auth/logout/`, where it's explicitly blacklisted server-side via `rest_framework_simplejwt.token_blacklist`, so it can't be replayed even if it leaks.

*Why `localStorage` over HttpOnly cookies?* Cookies would need careful same-site/CORS configuration for the separate frontend/backend origins used here. `localStorage` is the pragmatic choice for this self-contained assessment; it does carry XSS exposure, which is documented under Known Issues below.

---

## How shelf roles (owner/editor/viewer) are enforced

Every shelf-mutating view independently re-derives the caller's role from the database — the frontend's UI state is never trusted:

```python
# api/views.py — shelf_books (add/remove a book from a shelf)
is_owner = shelf.owner == req.user
share    = shelf.shares.filter(user=req.user).first()

if not is_owner and (not share or share.role != 'EDITOR'):
    return Response({'error': 'Only the shelf owner or an editor can add or remove books'},
                     status=403)
```

The same pattern (look up `shelf.owner` and `shelf.shares.filter(user=...)` directly, then branch) is repeated in every relevant view:

- **OWNER only**: edit shelf name (`shelf_detail` PUT), delete shelf, share shelf / change a collaborator's role (`share_shelf`), remove a collaborator (`remove_collaborator`).
- **OWNER or EDITOR**: add/remove books on the shelf (`shelf_books`).
- **OWNER, EDITOR, or VIEWER**: read the shelf (`shelf_detail` GET) — any of the three roles grants visibility, but only the first two grant write access.

A Viewer calling `POST /api/shelves/<id>/books/` directly (bypassing the UI entirely) hits the exact same `share.role != 'EDITOR'` check and is rejected with `403 Forbidden` — there's no separate "UI-only" code path that could be skipped. The frontend hides buttons a Viewer shouldn't see purely for UX; the backend is the actual enforcement boundary, and we verified this by calling the endpoints directly with a Viewer's token.

---

## WebSocket setup

### Authentication
The client connects with the JWT access token as a query parameter:
```
ws://localhost:8000/ws/updates/?token=<access_token>
```
A custom `JWTAuthMiddleware` (`api/middleware.py`) intercepts the connection before the Channels routing layer sees it: it parses the token from the query string, validates it with SimpleJWT's `AccessToken`, and attaches the resolved Django `User` to `scope['user']`. If the token is missing, expired, or invalid, `scope['user']` is set to `AnonymousUser` and the consumer immediately closes the connection with code `4001` in `connect()` — no anonymous socket is ever accepted into a group.

### Scoping events to the right user (no global broadcast)
On a successful connection, `UpdateConsumer.connect()` joins the socket to exactly two kinds of channel groups:
1. **`user_<id>`** — a personal group for that user alone. Activity-feed events and lending notifications (`book_lent`, `book_returned`) are sent only here.
2. **`shelf_<id>`** — one group per shelf the user owns *or* has a `ShelfShare` row for. Book add/remove/delete events on a shelf (`shelf_updated`) are broadcast only to that shelf's group, so a Viewer with no access to a different shelf never receives anything about it.

When a shelf is newly shared with someone, the server sends a `shelf_shared` event to that user's `user_<id>` group. The client responds by sending `{ "type": "refresh_shelves" }` back over the same socket; the consumer's `receive()` handler then re-computes and re-joins the user's current set of `shelf_<id>` groups, so newly-granted access takes effect without a reconnect.

Server-side broadcasts use Django Channels' `channel_layer.group_send`, scoped to one group name at a time — there is no code path that sends to "all connected clients."

### Disconnects and reconnects
`useWebSocket.js` attaches an `onclose` handler that schedules a reconnect with capped exponential backoff (2s, 4s, 8s, up to a 15s ceiling) rather than retrying immediately or giving up. A ref flag prevents reconnect attempts after the component unmounts (e.g. on logout or navigation away). Because all page data is loaded via REST on mount, the app remains fully functional with the socket down — WebSocket events only layer live deltas on top of REST-fetched state; a manual refresh always recovers current state if the socket is unavailable.

---

## What was hard and how I worked through it

**Diagnosing WebSocket close code 1006.** The browser only reports a generic "abnormal closure" with no server-side reason. I added explicit logging in both `JWTAuthMiddleware` and `UpdateConsumer` (`WS connected: user=...`, `WS auth: invalid/expired token`) and a Django `LOGGING` config so these print straight to the terminal — this made it possible to confirm in one log line whether a failure was an auth problem or a transport problem (in my case, the actual root cause turned out to be running `manage.py runserver`, which is WSGI-only and cannot upgrade to a WebSocket connection at all).


**Real-time consistency when a book is deleted from multiple shelves at once.** A book can belong to several shelves simultaneously. Deleting it has to notify every one of those shelves' live viewers, but by the time the broadcast fires, the M2M rows (and therefore the list of "affected shelves") would already be gone if I queried after `book.delete()`. The fix was capturing `book.shelves.values_list('id', flat=True)` *before* calling delete, then looping over that captured list to broadcast to each `shelf_<id>` group afterward.

**Multi-tab testing confusion.** Two tabs logged into two different accounts appeared to "swap" users on refresh. This is expected `localStorage` behaviour (shared per browser origin, not per tab) rather than an auth bug — documented above so it doesn't get mistaken for a real defect during review.

---

## Known issues / what is incomplete

- `InMemoryChannelLayer` only works within a single server process; it will not broadcast correctly across multiple Daphne workers or instances. Production deployment needs `channels_redis` with a real Redis backend.
- JWT tokens live in `localStorage`, which is readable by any script running on the page (XSS exposure). HttpOnly cookies would close this gap but require same-site/CORS work across the two origins used here.
- No automated test suite yet (auth, lending edge cases, and RBAC are all manually verified against the live API).
- No email notification when a book is lent (mock/console email was a stretch goal, not implemented).
- No CSV import and no Docker Compose setup.

---

## What I would improve with more time

- Swap to a Redis-backed channel layer and add a docker-compose file (backend + frontend + Redis) for one-command startup and realistic multi-worker testing.
- Add a pytest-django suite specifically targeting the RBAC matrix (every owner/editor/viewer × every endpoint) and the lending state machine (self-lend, double-lend, return-without-lend, etc.) — these are exactly the areas most likely to regress silently.
- Move auth tokens to HttpOnly cookies with a same-site-aware CORS setup, removing the XSS surface entirely.
- Add optimistic UI updates (e.g. instant book-removed-from-shelf feedback before the server round-trip completes) with rollback on failure.
- Deploy a live instance (Render/Railway) with PostgreSQL instead of SQLite, for a more representative demo environment.

---

## Where I used AI and what I learned

I used Claude (Anthropic) throughout development for:
- **Bug diagnosis from raw server logs.** Pasting the actual Daphne terminal output (not just symptoms) let it pinpoint the missing `auth/refresh/` route and the un-broadcast book-delete path precisely, rather than guessing — this taught me to always capture and share the actual log/error text rather than describing a symptom secondhand.
- **WebSocket authentication and group-scoping design.** I knew I needed "only the right users get the right events" but hadn't built Channels middleware before; working through the `scope['user']` injection pattern with Claude clarified that Channels' middleware stack is separate from Django's normal request/auth pipeline and has to be wired explicitly.


Everything generated was read, tested against the running app, and adjusted — in particular the WebSocket scoping logic and the refresh-token flow were traced through manually (in the browser console and the Daphne terminal) until I could explain exactly why each piece worked, since those were the parts I understood least going in.