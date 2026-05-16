# WashTech Developer Handoff

## Recommended Product Structure

Keep only three role surfaces:

1. **Admin**
2. **Captain**
3. **Customer**

Treat **Manager** as a permission subset inside the admin control panel, not as a separate frontend surface.

## Priority Findings

### P0 - Secrets exposed in source

- Firebase service account credentials are hardcoded in [api/index.ts](./api/index.ts).
- Immediate action:
  - move credentials to environment variables
  - rotate exposed keys
  - remove hardcoded fallbacks from source

### P0 - Backend authorization gaps

- Sensitive routes must be protected on the server, not just hidden in UI.
- Review admin-only endpoints including:
  - reset
  - settings
  - automation
  - notification configuration

**Action:**
- add shared auth middleware
- validate token
- validate role
- reject unauthorized access with clear status codes

### P1 - Plaintext password handling

- Manager authentication currently compares plaintext credentials.
- Review the same pattern for any other role that still relies on weak secret handling.

**Action:**
- hash passwords with `bcrypt`
- store only hashes
- standardize login and token issue flow

### P1 - Duplicate control panel surfaces

- `/manager` and `/admin` split operational responsibility and duplicate mental models.

**Action:**
- fold manager functionality into admin sections
- keep one shell and one navigation structure
- drive feature access through role permissions

### P1 - Booking date model is too weak

- The booking flow uses relative labels like `today` and `tomorrow`.

**Action:**
- store absolute service date
- store slot identifier separately
- use normalized values for sorting, reporting, and capacity checks

### P1 - No slot capacity or duplicate booking guard

- Booking creation should validate the requested date and slot before insertion.

**Action:**
- enforce capacity rule
- block near-duplicate submissions
- consider uniqueness checks using phone + date + slot

### P2 - Status lifecycle is inconsistent

- Legacy states such as `on_process` still exist and increase UI/backend drift.

**Action:**
- settle on one lifecycle:
  - `pending`
  - `approved`
  - `assigned`
  - `on_route`
  - `completed`
  - `cancelled`
- update labels, transitions, and filters together

### P2 - Customer location flow is brittle

- Reverse geocoding runs directly in the browser against OpenStreetMap.

**Action:**
- move geocoding behind the backend if retained
- keep manual address entry as the reliable primary path

### P2 - Documentation drift

- `WASHTECH_CONTEXT.md` contains stale assumptions about auth and UX.

**Action:**
- update role model
- update auth notes
- update known gaps list
- add a short architecture decision record for the manager/admin merge

## Implementation Recommendation

### Frontend

- remove standalone manager route
- create a single admin shell with permission-based sections
- simplify status language shown to humans
- keep captain interface task-focused and minimal
- strengthen customer success and tracking states

### Backend

- centralize auth and role middleware
- harden secret management
- normalize booking payload shape
- add booking validation before write
- make finance updates safer and more auditable

## Suggested Work Plan

### Sprint 1

- secret rotation and env migration
- route protection middleware
- password hashing and token cleanup

### Sprint 2

- manager-to-admin merge
- admin permission model
- status cleanup

### Sprint 3

- booking validation and slot capacity
- tracking improvements
- documentation refresh

## Delivery Notes

- Keep the client-facing story simple: “three experiences only.”
- Keep the engineering story explicit: “security and permission hardening before feature growth.”
- Any future dashboard work should happen inside the unified admin shell unless there is a strong business reason to split it again.
