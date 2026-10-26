# LeadPilot: CRM & Sales Pipeline Management

LeadPilot helps a sales team manage leads, companies, follow-up tasks and pipeline progress in one place. Built for the LearnDepth Academy LLP Round 2 assessment.

**Stack:** Next.js (App Router) + TypeScript, SQLite via Prisma 6, Zod validation, JWT cookie auth (jose + bcryptjs). Everything is free and runs locally with no external services.

## Setup

Requires Node.js 20 or newer.

```bash
git clone https://github.com/lavanya-js/leadpilot.git
cd leadpilot
npm install
cp .env.example .env        # Windows: copy .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:3000. Set a long random `JWT_SECRET` in `.env` (at least 16 characters).

### Demo accounts (all use password `Password123!`)

| Email | Role |
|---|---|
| admin@leadpilot.test | Admin |
| priya@leadpilot.test | Sales Member |
| rohan@leadpilot.test | Sales Member |

The seed creates 6 pipeline stages, 6 companies, 36 leads with activities, and tasks (some overdue).

## Features

- **Leads:** create, edit, archive, search, filter by stage/source/owner, pagination, CSV export
- **Companies:** create, edit, archive (Admin), duplicate detection, search, pagination
- **Contacts:** managed per company, unique email, search, delete (Admin)
- **Pipeline:** configurable stages (New, Contacted, Qualified, Proposal, Won, Lost), safe stage moves
- **Activity timeline:** calls, meetings, emails and notes; stage changes are logged automatically
- **Tasks:** assignment, due dates, completion, overdue / upcoming / completed filters
- **Dashboard:** totals, pipeline value by stage, leads by source, win rate, conversion rate, task counts
- **Security:** authentication, role permissions, server-side validation, record-level access control

## Roles and permissions

All checks run on the server, in the API, not just in the UI.

| Action | Admin | Sales Member |
|---|---|---|
| View leads | All leads | Only leads they own |
| Create lead | Yes, can assign any owner | Yes, owner is always themselves |
| Edit / archive lead | Any lead | Own leads |
| Reassign lead owner | Yes | No |
| Move lead between stages | Any lead | Own leads |
| Reopen a Won or Lost lead | Yes | No |
| Log activities | Any lead | Own leads |
| View tasks | All tasks | Tasks assigned to or created by them, or on their leads |
| Create task | Can assign to anyone | Assigned to themselves only |
| Delete task | Any task | Only tasks they created |
| Create / edit companies | Yes | Yes |
| Archive companies | Yes | No |
| Dashboard | Company-wide numbers | Numbers for their own leads and tasks |

A lead or task a user is not allowed to see returns `404`, not `403`, so its existence is not revealed.

## Data model

| Table | Purpose |
|---|---|
| User | Name, email, bcrypt password hash, role (ADMIN or MEMBER) |
| Stage | Pipeline stages with a position and a kind (OPEN, WON, LOST) |
| Company | Name, normalized name key (unique), domain (unique), industry, archivedAt |
| Contact | Name, email (unique), phone, title, linked to a company |
| Lead | Contact details, source, value (INR), owner, stage, company, version (optimistic lock), archivedAt |
| Activity | Timeline entries: type (CALL, MEETING, EMAIL, NOTE, STAGE_CHANGE), text, author, lead |
| Task | Title, due date, completedAt, assignee, creator, optional lead |
| IdempotencyKey | Used to ignore repeated form submissions |

Key relationships: a Lead has one owner (User), one Stage and optionally one Company; a Lead has many Activities and Tasks; a Company has many Contacts and Leads. Indexes cover the owner, stage, source, company, email and archived columns used by list queries.

## Business rules and data integrity

- **Duplicate companies:** names are normalized (lowercased, punctuation and suffixes like Pvt, Ltd, LLP, Inc removed), so "Acme Pvt. Ltd." and "ACME" collide. Domains are also unique. Enforced in the API and by database unique indexes.
- **Duplicate leads:** one active lead per email address (archived leads do not count).
- **Soft delete:** leads and companies are archived, not deleted, so history and reports stay intact.
- **Safe stage changes:** a move must include the lead's current `version`. If someone else changed the lead first, the API returns `409 Conflict`. The stage change and its timeline entry are saved in one transaction.
- **Reopen rule:** only an Admin can move a lead out of Won or Lost.
- **Double submit protection:** `POST /api/leads` honours an `Idempotency-Key` header.
- **Validation:** every input is validated with Zod and returns `422` with per-field messages.

## Security

- Passwords stored as bcrypt hashes; login errors do not reveal whether the email exists
- Session is a signed JWT in an `httpOnly`, `SameSite=Lax` cookie (8 hours); the user's role is re-read from the database on every request
- Login throttling: 5 failed attempts per email per 10 minutes
- CSV export neutralises spreadsheet formulas (cells starting with `=`, `+`, `-`, `@`)
- Secrets live in `.env`, which is git-ignored; `.env.example` has placeholders only

## API overview

| Method and path | Purpose |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Authentication |
| `GET, POST /api/companies` | List (search, pagination) and create |
| `GET, PUT, DELETE /api/companies/:id` | View, edit, archive (Admin) |
| `GET, POST /api/leads` | List (search, filters, pagination) and create |
| `GET, PUT, DELETE /api/leads/:id` | View with timeline and tasks, edit, archive |
| `PATCH /api/leads/:id/stage` | Move stage, body `{ stageId, version }` |
| `GET, POST /api/leads/:id/activities` | Timeline |
| `GET /api/leads/export` | CSV export (respects filters and access) |
| `GET /api/stages` | Pipeline stages |
| `GET, POST /api/contacts`, `GET, PUT, DELETE /api/contacts/:id` | Contacts (search, duplicate email check, delete is Admin only) |
| `GET /api/users` | People a lead or task can be assigned to |
| `GET, POST /api/tasks` | List (`status=overdue\|upcoming\|completed`) and create |
| `PATCH, DELETE /api/tasks/:id` | Edit or complete, delete |
| `GET /api/dashboard` | Role-scoped metrics |

Errors use one shape: `{ "error": { "message": "...", "details": { ... } } }`.

### Dashboard metrics

- **Win rate** = Won ÷ (Won + Lost)
- **Conversion rate** = Won ÷ all active leads

## Screens

| Screen | Route | What it does |
|---|---|---|
| Login | `/login` | Sign in, with one-click demo accounts |
| Dashboard | `/dashboard` | Totals, pipeline value by stage, win and conversion rates, leads by source, overdue and upcoming tasks |
| Leads | `/leads` | Search, stage and source filters, pagination, CSV export |
| Add lead | `/leads/new` | Validated form with duplicate-email check and double-submit protection |
| Lead detail | `/leads/:id` | Stage bar, activity timeline, follow-up tasks, archive |
| Pipeline | `/pipeline` | Board with a column per stage; drag a card or use its Move to menu |
| Companies | `/companies` | List, search, add, archive (Admin) |
| Company detail | `/companies/:id` | Edit company, manage its contacts, see its leads |
| Tasks | `/tasks` | All, Overdue, Upcoming and Completed tabs; add, assign and complete tasks |

## Tests

```bash
npm test
```

Vitest unit tests cover the duplicate-detection rule (company name and email normalization) and the role and record access rules for leads and tasks. API behaviour (validation errors, permission checks, stage conflicts, duplicates) was verified manually with curl against the seeded database.

## Known limitations

- Login throttling is in memory, so it resets when the server restarts.
- The pipeline board loads the first 100 leads; the Leads page lists all of them.
- Users come from the seed data; there is no user management or password reset screen.
- Contacts are managed from the company page; the lead form links a lead to a company, not to a specific contact.
- There are no automated end-to-end or API integration tests yet.