# WashTech — Complete Developer Context

> **Purpose:** Use this file to onboard a new conversation. Read it, then check `git log --oneline -5` and `git diff HEAD origin/main --name-only` to catch any changes pushed from another IDE since this was written.

---

## App Overview

Car wash on-demand booking system for Iraq (Erbil). Customers book via a web app, the manager approves via WhatsApp one-click links, a captain/driver accepts and completes the job, and the system tracks finances with a 70/30 split.

**Live URL:** `https://wash-tech-v2.vercel.app`

Language: Arabic (RTL, `dir="rtl"`) with some Kurdish. All user-facing strings are in Arabic.

---

## Repositories

| Repo | GitHub | Branch | Push command |
|------|--------|--------|--------------|
| **WashTech-v2 — PRIMARY** | `Sahii97/WashTech-v2` | `main` | `git push origin HEAD:main` |
| WashTech (old Express monolith) | `Sahii97/WashTech` | `claude/fix-reset-n8n-integration-AYw5T` | `git push -u origin claude/fix-reset-n8n-integration-AYw5T` |

**Always develop on WashTech-v2.** The old WashTech repo is a legacy monolith — only touch it if the user explicitly asks.

### Git rules (must follow every session)
- Always `--no-gpg-sign` on commits
- WashTech-v2: `git push origin HEAD:main`
- WashTech: `git push -u origin claude/fix-reset-n8n-integration-AYw5T`
- Never push to wrong branch
- Always answer in English

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS 3 |
| Routing | react-router-dom v6 |
| Backend | Express.js exported as Vercel serverless function |
| Database | Firebase Firestore (client SDK — tech debt, should be Admin SDK) |
| WhatsApp | WasenderAPI (`POST https://wasenderapi.com/api/send-message`) |
| Deployment | Vercel |
| Short links | Firestore `links/{code}` + `/go/:code` route |
| Settings | Firestore `settings/{key}` generic key-value store |

---

## Project File Structure

```
/api/index.ts                   ← ALL backend logic (Express app, exported as serverless)
/src/App.tsx                    ← Router, DevNav, dark mode
/src/main.tsx                   ← React root, SettingsProvider wrapper
/src/contexts/SettingsContext.tsx ← Finance config + app config (loaded from /api/admin/settings/*)
/src/components/
  MessageCard.tsx               ← WhatsApp-style bubble with markdown parser (*bold*, _italic_, URLs)
  SearchableDropdown.tsx        ← Reusable searchable dropdown component
/src/pages/
  BookingPage.tsx               ← Customer booking (3-step form, AR/KU bilingual)
  ManagerDashboard.tsx          ← Manager: approve/reject bookings, revenue overview
  CaptainView.tsx               ← Captain: pick identity → active tasks → wallet history
  AdminDashboard.tsx            ← Admin: notification templates, automation rules, drivers, managers
  ActionPage.tsx                ← One-click WhatsApp action page (approve/reject/accept/on_road/complete)
  TrackPage.tsx                 ← Customer tracking by phone number
/vercel.json                    ← Routes: /api/:path* + /go/:code → /api/index, /* → /index.html
/server.ts                      ← Local dev server (not used in production)
```

---

## Routes (vercel.json)

```json
{
  "functions": { "api/index.ts": { "maxDuration": 30 } },
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" },
    { "source": "/go/:code",   "destination": "/api/index" },
    { "source": "/(.*)",       "destination": "/index.html" }
  ]
}
```

Frontend routes (React Router):
- `/` → BookingPage
- `/manager` → ManagerDashboard
- `/driver` or `/captain` → CaptainView
- `/admin` → AdminDashboard
- `/action` → ActionPage
- `/track` → TrackPage

---

## Booking State Machine

```
pending ──approve──► approved ──accept──► accepted ──on_road──► on_road ──complete──► completed ──close──► closed
        ──reject──► rejected
approved ──on_process──► on_process (legacy alias — phasing out)
on_process ──on_road──► on_road | ──complete──► completed
```

Server-side enforcement via `ALLOWED_TRANSITIONS`:

```typescript
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:    ['approved', 'rejected'],
  approved:   ['accepted', 'rejected', 'on_process'],
  accepted:   ['on_road'],
  on_road:    ['completed'],
  completed:  ['closed'],
  on_process: ['on_road', 'completed'],
  rejected:   [],
  closed:     [],
};
```

Every status change validates against this map. Returns `409` on illegal transition.

---

## Package Prices (IQD)

```typescript
const PACKAGE_PRICES: Record<string, number> = {
  basic: 15000, standard: 25000, premium: 35000,
  'أساسي': 15000, 'قياسي': 25000, 'ممتاز': 35000,
};
const CAPTAIN_SHARE_PCT = 0.70; // captain 70%, company 30%
```

These are the hardcoded defaults. The system also reads `settings/finance_config` from Firestore (stored by SettingsContext), so prices can be changed from the admin panel without redeploying. The lookup in `complete-task` tries: `pkgKey.toLowerCase()` first, then `booking.package` directly.

**Known bug:** BookingPage stores the Arabic display name (e.g. `'قياسي'`) as the package. The lookup tries Arabic keys too, so it works — but it's fragile if the display name changes.

---

## Notification System

### 6 EventKeys

| EventKey | Trigger point | Default recipient |
|----------|--------------|------------------|
| `new_booking` | Customer submits booking | Manager |
| `booking_approved` | Manager approves | Captain |
| `driver_accepted` | Captain accepts task | Customer |
| `booking_rejected` | Manager rejects | Customer |
| `captain_on_road` | Captain starts driving | Customer |
| `booking_completed` | Service completed | Customer |

### Template variables by event

| Event | Available `{{vars}}` |
|-------|---------------------|
| `new_booking` | `id, name, phone, neighborhood, carType, package, date, slot, approveLink, rejectLink` |
| `booking_approved` | `name, phone, neighborhood, slot, driverName, driverPhone, acceptLink` |
| `driver_accepted` | `name, phone, driverName, slot` |
| `booking_rejected` | `name, phone` |
| `captain_on_road` | `name, phone, driverName, slot` |
| `booking_completed` | `name, phone, amount` |

Templates stored in `settings/notification_templates` (Firestore). Editable in AdminDashboard.

### `notify()` function

```typescript
async function notify(event: EventKey, vars: Record<string, string>, fallbackTo: string): Promise<void>
```

- If `N8N_WEBHOOK_URL` env var is set → sends all events to n8n (bypasses WhatsApp logic)
- Otherwise: loads templates + automation rules → resolves recipients → calls `sendWhatsApp()`
- **Important:** All `notify()` calls must be `await`ed before `res.json()` in serverless context

### Automation Rules

```typescript
interface AutomationRule {
  id: string;
  enabled: boolean;
  trigger: EventKey;
  recipientType: 'manager' | 'captain' | 'customer' | 'custom';
  customPhone?: string;
}
```

Stored in `settings/automations`. Default rules (one per event) are merged with any saved rules.

`resolveRecipient()` maps `recipientType` to actual phone number from `vars`:
- `manager` → `MANAGER_PHONE` (env var)
- `captain` → `vars.driverPhone`
- `customer` → `vars.phone`
- `custom` → `rule.customPhone`

---

## Short Link System

```typescript
async function createShortLink(url: string, type: 'action' | 'track' = 'action'): Promise<string>
```

- Creates `links/{code}` in Firestore (6-char alphanumeric code)
- `action` links: 48h expiry, single-use (marked `used: true` after first click)
- `track` links: 7-day expiry, multi-use (click-counted but not locked)
- Graceful fallback: if Firestore fails, returns the original long URL (no exception thrown)
- `/go/:code` checks expiry + single-use status, records click, then `res.redirect(link.url)`

---

## Captain Wallet

```
drivers/{id}.wallet = { balance, totalEarned, totalWithdrawn }
drivers/{id}/transactions/{txId} = { type, amount, bookingId, note, createdAt }
```

- Credited automatically when booking reaches `completed` status (in both `/api/action` and `/api/driver/complete-task`)
- `creditCaptainWallet(driverId, amount, bookingId, note)` helper in api/index.ts
- `type` values: `'earning'`, `'withdrawal'`, `'adjustment'`

**Known issue:** Two separate Firestore writes (balance update + transaction add) — not atomic. If second write fails, wallet balance and transaction history go out of sync.

---

## Dynamic Settings (SettingsContext)

The frontend `SettingsContext` (at `src/contexts/SettingsContext.tsx`) loads:
- `/api/admin/settings/finance` → `FinanceConfig { captainSharePct, packagePrices, currency }`
- `/api/admin/settings/app` → `AppConfig { appName, tagline, supportPhone, managerPhone }`

These are saved to Firestore `settings/finance` and `settings/app_config` respectively.

The generic settings endpoint pattern:
- `GET /api/admin/settings/:key` → returns `{ value }` or `{ value: null }`
- `POST /api/admin/settings/:key` → body `{ value }` → saves to Firestore

---

## All API Endpoints

```
GET  /api/health
GET  /go/:code                           ← short link redirect

# Slots & neighborhoods
GET  /api/slots
POST /api/slots
GET  /api/neighborhoods
POST /api/admin/neighborhoods
DELETE /api/admin/neighborhoods/:name

# Bookings
POST /api/bookings                        ← create + notify manager
GET  /api/bookings
GET  /api/bookings/:id
GET  /api/track?phone=                    ← customer tracking by phone

# Captains (stored in 'drivers' collection for Firestore compat)
GET  /api/captains                        ← returns both captains + drivers keys
GET  /api/drivers
POST /api/admin/create-captain            ← name, code, phone
POST /api/admin/create-driver             ← alias
DELETE /api/admin/captain/:id
DELETE /api/admin/driver/:id              ← alias

# Captain wallet
GET  /api/captain/wallet?driverId=        ← wallet + transactions
GET  /api/captain/transactions?driverId=&limit=
POST /api/captain/transaction             ← withdrawal or adjustment

# Captain auth & tasks
POST /api/captain/login                   ← code → captain object
POST /api/driver/login                    ← alias
GET  /api/captain/tasks?captainId=
GET  /api/driver/tasks?driverId=

# Captain workflow (state transitions)
POST /api/driver/accept-task             ← approved → accepted + notify customer
POST /api/driver/on-road                 ← accepted → on_road + notify customer (+ ownership guard)
POST /api/driver/complete-task           ← on_road → completed + financials + wallet (+ ownership guard)
POST /api/driver/update-status           ← legacy, now has state machine guard

# WhatsApp action links
GET  /api/action?id=
POST /api/action                          ← act: approve|reject|accept|on_road|complete

# Manager
POST /api/manager/login                   ← username+password or just password
POST /api/manager/action                  ← action: approve|reject
GET  /api/manager/finance/overview        ← revenue totals + captain wallet summaries
GET  /api/manager/finance/captains        ← per-captain wallet data

# Admin — managers
GET  /api/admin/managers
POST /api/admin/create-manager
DELETE /api/admin/manager/:id

# Admin — settings (generic)
GET  /api/admin/settings/:key
POST /api/admin/settings/:key

# Admin — automations
GET  /api/admin/automations
POST /api/admin/automations               ← replace all rules
POST /api/admin/automations/add           ← add one rule
PATCH /api/admin/automations/:id          ← update one rule
DELETE /api/admin/automations/:id         ← delete one rule

# Admin — notification templates
GET  /api/admin/notification-templates
POST /api/admin/notification-templates

# Admin — testing
POST /api/admin/test-notification         ← { event, testPhone } → sends one
POST /api/admin/test-all-notifications    ← { testPhone } → returns { results: [{event, ok, label}] }
POST /api/admin/simulate-cycle            ← { testPhone } → runs full 5-step cycle with real WA messages

# Admin — reset
POST /api/admin/reset                     ← ⚠️ deletes ALL bookings, links, drivers, resets defaults
```

---

## Firestore Collections

```
bookings/{id}
  name, phone, neighborhood, carType, package, date, slot
  status (pending|approved|accepted|on_road|completed|closed|rejected)
  driverId (set when approved)
  createdAt, updatedAt
  statusHistory: [{ status, at, by }]
  financials: { totalAmount, captainShare, companyShare }
  isTest: boolean (simulate-cycle bookings)

drivers/{id}
  name, code (PIN for login), phone
  wallet: { balance, totalEarned, totalWithdrawn }

drivers/{id}/transactions/{txId}
  type ('earning'|'withdrawal'|'adjustment'), amount, bookingId, note, createdAt

managers/{id}
  name, username, password (plaintext — tech debt)

links/{code}
  url, type ('action'|'track'), createdAt, expiresAt
  used (boolean), usedAt
  clicks: [{ at, ua }]

settings/slots              → { value: string[] }
settings/neighborhoods      → { value: string[] }
settings/notification_templates → { value: Record<EventKey, { enabled, template }> }
settings/automations        → { value: AutomationRule[] }
settings/finance_config     → { value: { captainSharePct, packagePrices } }
settings/finance            → { value: FinanceConfig } (used by SettingsContext)
settings/app_config         → { value: AppConfig } (used by SettingsContext)
```

---

## Environment Variables

```bash
# Firebase
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_DATABASE_ID=ai-studio-ae98497f-378e-4913-8fbf-662dadf0b548

# WhatsApp
WASENDER_API_TOKEN           # Bearer token for WasenderAPI

# App
MANAGER_PHONE=+9647809471576
MANAGER_PASSWORD=admin123    # fallback password if no managers in Firestore
APP_URL=https://wash-tech-v2.vercel.app
N8N_WEBHOOK_URL              # if set, bypasses ALL WhatsApp and sends to n8n instead
```

All Firebase values have hardcoded fallbacks in `api/index.ts` for local dev.

---

## Phone Normalization

```typescript
function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '');
  if (/^07\d{9}$/.test(clean))     return '+964' + clean.slice(1);  // 07XXXXXXXXX → +9647XXXXXXXXX
  if (/^9647\d{9}$/.test(clean))   return '+' + clean;
  if (/^\+9647\d{9}$/.test(clean)) return clean;
  if (/^\+/.test(clean))           return clean;
  return '+' + clean;
}
```

Used at booking creation and WhatsApp send. The `track` endpoint normalizes both the query and stored phone before comparing.

---

## Frontend Components

### MessageCard (`src/components/MessageCard.tsx`)
WhatsApp-style message bubble with:
- Green bubble (#dcf8c6 light / #1a3a2a dark), right-align tail
- Parses `*bold*`, `_italic_`, URLs (shown without protocol)
- `─────` lines render as `<hr>`
- Double blue tick icon in footer
- Used in AdminDashboard notification template preview

### SearchableDropdown (`src/components/SearchableDropdown.tsx`)
Reusable dropdown with search input, used for neighborhood/car type selection in BookingPage.

### SettingsContext (`src/contexts/SettingsContext.tsx`)
React context providing:
- `finance: FinanceConfig` (captainSharePct, packagePrices, currency)
- `app: AppConfig` (appName, tagline, supportPhone, managerPhone)
- `saveFinance(cfg)` / `saveApp(cfg)` → POST to `/api/admin/settings/:key`
- `reload()` → re-fetches from API

Wrapped around `<App>` in `src/main.tsx`.

---

## Page Summary

### BookingPage
3-step form:
1. Name + phone
2. Neighborhood (searchable + GPS detect) + car type + package (basic/standard/premium in Arabic)
3. Date (today/tomorrow) + time slot

**Known bug:** No price shown to customer. They confirm the booking without knowing the cost.

### ManagerDashboard
- Tabs: pending / active / completed / rejected
- Approve action opens driver selector
- Finance tab showing revenue totals from completed bookings
- No authentication in current build (anyone who navigates to `/manager` gets in)

### CaptainView
Captain picker screen → main task view with 3 tabs:
- **Active tasks:** shows `approved` (accept button) / `accepted|on_process` (on-road button) / `on_road` (complete button with confirmation modal)
- **Completed:** last 5 completed tasks with captain share earned
- **Wallet:** balance/earned/withdrawn cards + paginated transaction history

### AdminDashboard
- **Notifications tab:** Edit templates for all 6 events; enable/disable toggle; real-time preview via `MessageCard` with sample vars replacing `{{syntax}}`; per-event test button; "test all" button
- **Automation tab:** Full CRUD for AutomationRule — if/then cards, add/edit/delete inline, toggle enabled
- **Captains tab:** List, add, delete captains
- **Managers tab:** List, add, delete manager accounts
- **Locations tab:** Add/delete neighborhoods, edit time slots

### ActionPage
URL: `/action?id=BOOKING_ID&act=approve|reject|accept|on_road|complete`
- Loads booking data + (for approve) list of available captains
- Shows booking summary in Arabic
- Approve action shows custom `DriverDropdown` (avatar with initials, name, phone)
- Handles 409 conflict with user-friendly Arabic error
- Confirmation button sends POST to `/api/action`

### TrackPage
- Search by phone number → lists all bookings for that phone
- Shows status badge + booking details + animated pulse for in-progress statuses

---

## Known Technical Debt (Priority Order)

1. **No API authentication** — any caller can hit `/api/admin/reset`, read all bookings, etc. Fix: add a secret header check on all `/api/admin/*` endpoints.
2. **Captain auth is name picker** — anyone can pick any captain. Fix: add PIN login screen (code already exists in `/api/captain/login`).
3. **notify() bypassed in some paths** — `accept-task` / `on-road` / `complete-task` now use `notify()` correctly, but check when adding new endpoints.
4. **No price shown to customer** — BookingPage step 2 shows package names but no IQD amount. Fix: read `SettingsContext.finance.packagePrices` and show price next to each package option.
5. **`on_process` zombie status** — legacy alias for `accepted` still in state machine and all status maps. Creates UI confusion. Should migrate all existing `on_process` records to `accepted` and remove it.
6. **No slot capacity management** — unlimited bookings can be made for the same slot. Fix: count active bookings per slot and block full slots.
7. **Wallet writes not atomic** — `updateDoc(wallet)` + `addDoc(transaction)` are two separate writes. Use Firestore batched writes.
8. **Firebase client SDK on server** — using `firebase/app` (browser SDK) in Node serverless context. Should migrate to `firebase-admin`.
9. **"Today/Tomorrow" stored literally** — no actual dates, no timezone handling. A booking made at 11 PM for "today" may be in the past by morning.
10. **Passwords in plaintext** — manager passwords stored in Firestore without hashing.
11. **No duplicate booking prevention** — same phone + same slot → multiple bookings created silently.
12. **No cancellation flow** — no way for customer or manager to cancel an accepted/in-progress booking.
13. **Test simulation creates real Firestore records** — simulate-cycle bookings use `isTest: true` flag but are never cleaned up.
14. **DevNav always visible** — the dev navigation bar (`?superadmin=false` hides it) is shown to all users by default. Not production-ready.

---

## Starting a New Session Checklist

```bash
# 1. Pull latest (in case another IDE pushed changes)
cd /home/user/WashTech-v2
git fetch origin main
git diff HEAD origin/main --name-only  # what changed remotely?
git pull origin main

# 2. Review recent commits
git log --oneline -10

# 3. Check local state
git status
```

Then read the key files:
- `api/index.ts` — all backend logic
- The specific page(s) relevant to the task

---

## Default Test Data

```
Manager phone: +9647809471576
Manager password: admin123
Default captain: { id: 'd1', name: 'Ali', code: '1234', phone: '+9647809471576' }
App URL: https://wash-tech-v2.vercel.app
```
