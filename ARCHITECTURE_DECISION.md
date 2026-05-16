# WashTech Role Architecture Decision

## Decision

WashTech should use **three primary product surfaces**:

1. **Admin Control Panel**
2. **Captain View**
3. **Customer Booking/Tracking**

The current **Manager** experience should be merged into the admin control panel as a **restricted permission level**, not maintained as a separate app surface.

## Reasoning

- The manager and admin workflows overlap heavily.
- Separate back-office views increase product complexity without enough value.
- One control panel with role-based permissions is easier to train, support, and extend.

## Resulting Role Model

### Admin

- full booking access
- captain management
- finance and reporting
- settings and automations

### Operations Staff

- same admin shell
- limited permissions
- can manage bookings and operational status
- cannot access high-risk settings or finance controls unless granted

### Captain

- sees only assigned work and captain actions

### Customer

- books service and tracks service

## Routing Recommendation

- keep `/` for booking
- keep `/track` for tracking
- keep `/captain` for captain use
- keep `/admin` as the only back-office route
- retire `/manager` after migration

## Migration Guidance

1. Move manager features into admin sections.
2. Add permission-aware navigation and route guards.
3. Redirect `/manager` to `/admin` for authorized users during transition.
4. Remove the standalone manager page after validation.
