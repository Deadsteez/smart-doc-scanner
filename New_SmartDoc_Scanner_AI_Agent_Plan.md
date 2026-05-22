__SmartDoc Scanner__

__AI Agent Implementation Plan__

*Future Enhancements: Teams, Workspaces & External API Integrations*

Version 1\.0  |  May 2026

# 1\. Executive Summary

This document provides a detailed, agent\-executable implementation plan for the three future enhancements listed in the SmartDoc Scanner SRS: Multi\-User Collaboration \(Teams & Workspaces\), AI\-Powered Insights, and External Accounting API Integrations\. Each section is structured so an AI coding agent can follow it sequentially, understand dependencies, generate code, and verify correctness at each stage\.

The plan covers architecture decisions, data models, API contracts, UI components, security considerations, and test strategies\. It is written for a Nuxt 4 / Vue 3 stack with Supabase as the primary backend, Pinia for state management, and Tailwind CSS for styling\.

# PART A — Multi\-User Collaboration: Teams & Workspaces

## A\.1  Feature Overview & Goals

Teams and Workspaces allow multiple users to share, review, and approve scanned documents under a single organisational context\. The role model is intentionally minimal — just two roles — to keep the permission logic lean and the UI straightforward\.

- A user creates or joins a Workspace \(e\.g\. company name\)\.
- Every workspace member is either an Admin or a Member\. The workspace creator is always an Admin\.
- Documents uploaded by any member are visible to the whole workspace\.
- An approval workflow moves documents through Pending → Approved / Rejected states\.
- Real\-time notifications are delivered on status changes\.

## A\.2  Role Model

Two roles cover all practical needs for a document\-scanning app\. Role is stored as a single text column on workspace\_members\. There is no separate 'Owner' concept — the workspace creator is an Admin and is flagged by owner\_id on the workspaces table\.

__Permission__

__Admin__

__Member__

Invite / remove members

Yes

No

Upload documents

Yes

Yes

Submit document for approval

Yes

Yes

Approve / reject documents

Yes

No

View all workspace documents

Yes

Yes

Export data

Yes

Yes

Manage workspace settings

Yes

No

*📝 Agent instruction: Implement a usePermissions\(\) Pinia composable with a single isAdmin computed boolean\. Replace all role checks in templates and server routes with isAdmin\. No can\(action\) abstraction is needed — the two\-role model is simple enough for direct checks\.*

## A\.3  Data Model

Three tables are required\. The teams table from the original design is removed — workspace\-level sharing covers the SmartDoc use case without the added complexity\.

### A\.3\.1  workspaces

__Column__

__Type__

__Notes__

id

uuid \(PK\)

gen\_random\_uuid\(\)

name

text NOT NULL

Display name, e\.g\. Acme Corp

slug

text UNIQUE

URL\-safe, auto\-generated from name

owner\_id

uuid \(FK auth\.users\)

Workspace creator; always Admin

settings

jsonb

Timezone, locale, logo URL

created\_at

timestamptz

DEFAULT now\(\)

### A\.3\.2  workspace\_members

__Column__

__Type__

__Notes__

id

uuid \(PK\)

workspace\_id

uuid \(FK workspaces\)

Cascade delete

user\_id

uuid \(FK auth\.users\)

role

text

admin | member  \(only two values\)

invited\_by

uuid

Who sent the invite

joined\_at

timestamptz

Set when invite accepted

### A\.3\.3  document\_approvals

__Column__

__Type__

__Notes__

id

uuid \(PK\)

document\_id

uuid \(FK documents\)

workspace\_id

uuid \(FK\)

Denormalised for RLS performance

status

text

pending | approved | rejected

submitted\_by

uuid

Who submitted for approval

reviewed\_by

uuid

Admin who last acted on it

notes

text

Optional reviewer comment

updated\_at

timestamptz

DEFAULT now\(\), trigger\-maintained

*📝 Agent instruction: The status enum is reduced to 3 values \(pending, approved, rejected\)\. The 'in\_review' state is removed — Admins act directly on pending documents\. This simplifies the state machine and halves the number of RLS policy branches\.*

## A\.4  Invitation System

### A\.4\.1  Flow

1. Admin enters invitee email in Workspace Settings\. Role dropdown has only two options: Admin or Member\.
2. Frontend calls POST /api/workspace/invite with \{ email, role, workspace\_id \}\.
3. A Supabase Edge Function generates a signed JWT invite token \(exp: 72h\) and sends an email via Resend\.
4. Invitee clicks the link, lands on /invite?token=\.\.\.; frontend validates the token and calls POST /api/workspace/accept\-invite\.
5. A row is inserted into workspace\_members with the role from the token\.
6. Invitee is redirected to the workspace dashboard\.

### A\.4\.2  Edge Function: invite\.ts

// supabase/functions/invite/index\.ts

import \{ sign \} from 'jsonwebtoken'

import \{ Resend \} from 'resend'

Deno\.serve\(async \(req\) => \{

  const \{ email, role, workspace\_id \} = await req\.json\(\)

  // role must be 'admin' | 'member' — validate before signing

  if \(\!\['admin', 'member'\]\.includes\(role\)\) return new Response\('Bad role', \{ status: 400 \}\)

  const token = sign\(\{ email, role, workspace\_id \}, Deno\.env\.get\('INVITE\_SECRET'\), \{ expiresIn: '72h' \}\)

  await new Resend\(Deno\.env\.get\('RESEND\_API\_KEY'\)\)\.emails\.send\(\{

    from: 'noreply@smartdoc\.app',

    to: email,

    subject: 'You have been invited to a SmartDoc Workspace',

    html: \`<a href='$\{SITE\_URL\}/invite?token=$\{token\}'>Accept Invitation</a>\`

  \}\)

  return new Response\(JSON\.stringify\(\{ success: true \}\)\)

\}\)

## A\.5  Real\-Time Notifications

Use Supabase Realtime to push document approval status changes to all workspace members\.

1. Enable Realtime on the document\_approvals table in Supabase dashboard\.
2. Subscribe on workspace load in a Nuxt plugin\.

// composables/useRealtimeApprovals\.ts

const channel = supabase\.channel\('approvals:' \+ workspaceId\)

  \.on\('postgres\_changes', \{

    event: 'UPDATE', schema: 'public', table: 'document\_approvals',

    filter: \`workspace\_id=eq\.$\{workspaceId\}\`

  \}, \(payload\) => \{

    notificationStore\.push\(\{ type: 'approval', data: payload\.new \}\)

  \}\)\.subscribe\(\)

1. Render notifications in a global NotificationBell\.vue component backed by Pinia notificationStore\.
2. Persist unread count in localStorage; clear on open\.

## A\.6  Approval Workflow UI

### A\.6\.1  Components to Create

- WorkspaceDashboard\.vue — document list with status badge column\.
- ApprovalQueuePage\.vue — Admin\-only view filtered to status = 'pending'\.
- DocumentDetailModal\.vue — doc preview, extracted fields, and Approve / Reject buttons \(visible only when isAdmin = true\)\.
- ApprovalStatusBadge\.vue — grey=pending, green=approved, red=rejected\.

### A\.6\.2  Simplified State Machine

Three states, two transitions\. Both are validated server\-side before the DB update\.

- pending  →  approved  \(action: approve, Admin only\)
- pending  →  rejected  \(action: reject, Admin only\)
- rejected  →  pending  \(action: resubmit, original submitter only\)

## A\.7  Agent Execution Checklist — Teams & Workspaces

1. Run Supabase migration: create workspaces, workspace\_members, document\_approvals tables\.
2. Write RLS policies for all three tables\. Admin check = role = 'admin' on workspace\_members\.
3. Create useWorkspace\(\) Pinia store \(no useTeam needed\)\.
4. Implement usePermissions\(\) composable exposing isAdmin boolean\.
5. Build WorkspaceSettings page: member list, invite form with Admin/Member toggle\.
6. Deploy invite Edge Function; add INVITE\_SECRET and RESEND\_API\_KEY to env\.
7. Build /invite?token=\.\.\. accept\-invite page\.
8. Wire Supabase Realtime subscription in a Nuxt plugin\.
9. Build NotificationBell\.vue and notificationStore\.
10. Scaffold approval UI components \(see A\.6\.1\)\.
11. Write Vitest unit tests for isAdmin logic and state machine transitions\.
12. Write Playwright e2e: invite member → login → upload doc → submit → admin approves\.

# PART B — AI\-Powered Insights: Spend Analytics & Financial Reporting

## B\.1  Feature Overview

Once documents are parsed and stored, their extracted financial fields \(amount, vendor, date, category\) form a structured dataset that can power meaningful analytics\. The Insights module provides:

- Monthly and quarterly spend summaries per category and vendor\.
- Trend lines showing spending over time\.
- Budget vs\. actual comparisons \(if budgets are set\)\.
- AI\-generated narrative summaries of spend patterns using the Claude API\.
- Exportable reports in PDF and CSV formats\.

## B\.2  Data Requirements

The analytics engine reads from the existing documents table\. The agent must ensure the following fields are consistently populated during OCR parsing:

__Field__

__Type__

__Source__

amount

numeric\(12,2\)

Extracted by OCR / NLP, always stored in base currency

currency

char\(3\)

ISO 4217, default to workspace locale

vendor\_name

text

Extracted vendor / payee name

document\_date

date

Invoice or receipt date

category

text

AI\-classified: travel, office, utilities, etc\.

tax\_amount

numeric\(12,2\)

Extracted tax line

workspace\_id

uuid

For workspace\-scoped queries

## B\.3  Analytics Queries \(Supabase / PostgreSQL\)

### B\.3\.1  Monthly Spend by Category

SELECT

  date\_trunc\('month', document\_date\) AS month,

  category,

  SUM\(amount\) AS total,

  COUNT\(\*\) AS doc\_count

FROM documents

WHERE workspace\_id = $1

  AND document\_date >= NOW\(\) \- INTERVAL '12 months'

GROUP BY 1, 2

ORDER BY 1 DESC, 3 DESC;

### B\.3\.2  Top Vendors by Spend

SELECT vendor\_name, SUM\(amount\) AS total, COUNT\(\*\) AS invoices

FROM documents

WHERE workspace\_id = $1

GROUP BY vendor\_name

ORDER BY total DESC

LIMIT 10;

*📝 Agent instruction: Wrap all analytics queries in a Supabase RPC function \(Postgres stored procedure\) to avoid exposing raw SQL in client code\. Example: SELECT \* FROM get\_monthly\_spend\($1, $2, $3\)*

## B\.4  Frontend Charts

Use Chart\.js \(already in the tech stack\) wrapped in Vue composables\. The agent must create the following chart components:

__Component__

__Chart Type__

__Data Source__

MonthlySpendBar\.vue

Stacked Bar

get\_monthly\_spend RPC

CategoryDonut\.vue

Doughnut

get\_spend\_by\_category RPC

VendorLeaderboard\.vue

Horizontal Bar

get\_top\_vendors RPC

SpendTrendLine\.vue

Line \(rolling 30d\)

get\_daily\_spend RPC

BudgetGauge\.vue

Gauge / Radial

budgets table vs\. actual

## B\.5  AI Narrative Summaries

After fetching analytics data, the app calls the Claude API to generate a plain\-English narrative\. This runs server\-side inside a Nuxt server route to protect the API key\.

### B\.5\.1  Server Route: /api/insights/narrative\.post\.ts

// server/api/insights/narrative\.post\.ts

import Anthropic from '@anthropic\-ai/sdk'

export default defineEventHandler\(async \(event\) => \{

  const \{ spendData, period \} = await readBody\(event\)

  const client = new Anthropic\(\{ apiKey: process\.env\.ANTHROPIC\_API\_KEY \}\)

  const message = await client\.messages\.create\(\{

    model: 'claude\-opus\-4\-20250514',

    max\_tokens: 512,

    messages: \[\{

      role: 'user',

      content: \`Summarise the following spend data for $\{period\} in 3 sentences

        for a small business owner\. Highlight anomalies and top categories\.

        Data: $\{JSON\.stringify\(spendData\)\}\`

    \}\]

  \}\)

  return \{ narrative: message\.content\[0\]\.text \}

\}\)

## B\.6  Budget Management

Add a budgets table to allow owners/admins to set monthly spending limits per category:

__Column__

__Type__

__Notes__

id

uuid \(PK\)

workspace\_id

uuid \(FK\)

category

text

Matches document category values

monthly\_limit

numeric\(12,2\)

Budget ceiling for the category

alert\_threshold

numeric\(3,2\)

e\.g\. 0\.80 = alert at 80% of limit

period

text

monthly | quarterly | annual

When a new document is saved, a Supabase Database Webhook triggers a Supabase Edge Function that checks if the running total for the category has crossed the alert\_threshold and sends a push notification via the existing notification system\.

## B\.7  Report Export

The Insights page must expose an Export Report button that calls a server route generating a PDF report using Puppeteer \(server\-side\) or html\-pdf\-node\. The report must include:

- Cover page: workspace name, period, generated date\.
- Executive summary narrative \(from Claude API\)\.
- Monthly spend table\.
- Category breakdown with chart image \(rendered via Chart\.js node adapter\)\.
- Top vendors table\.
- Appendix: raw document list with amounts and dates\.

*📝 Agent instruction: Use @sparticuz/chromium and puppeteer\-core for serverless PDF generation on Vercel\. Pre\-render charts to base64 PNG on the client, pass them to the server route, and embed in the PDF template\.*

## B\.8  Agent Execution Checklist — Insights

1. Add amount, currency, vendor\_name, document\_date, category, tax\_amount to documents table \(migration\)\.
2. Create Supabase RPC functions: get\_monthly\_spend, get\_spend\_by\_category, get\_top\_vendors, get\_daily\_spend\.
3. Build useInsights\(\) Pinia store that fetches and caches RPC results\.
4. Scaffold chart components \(see B\.4\) using Chart\.js composable wrappers\.
5. Create /insights page in Nuxt with date\-range picker and workspace filter\.
6. Implement /api/insights/narrative\.post\.ts server route\.
7. Build BudgetManager\.vue: list, create, edit budget entries\.
8. Create budgets table migration with RLS\.
9. Write budget\-alert Edge Function and wire to Supabase Webhook\.
10. Implement /api/insights/export\-pdf\.post\.ts using Puppeteer\.
11. Write Vitest tests for RPC mock responses and narrative composable\.

# PART C — External Accounting API Integrations

## C\.1  Feature Overview

SmartDoc Scanner must sync extracted document data directly to the user's accounting software, eliminating manual re\-entry\. The three integrations to implement are QuickBooks Online, Xero, and Zoho Books\. The architecture uses a unified adapter pattern so adding future integrations requires only a new adapter class\.

## C\.2  Architecture — Unified Integration Adapter

### C\.2\.1  Interface Contract

All accounting adapters must implement the following TypeScript interface:

// types/accounting\.ts

export interface AccountingAdapter \{

  name: string                           // 'quickbooks' | 'xero' | 'zoho'

  connect\(workspaceId: string\): Promise<OAuthState>

  disconnect\(workspaceId: string\): Promise<void>

  isConnected\(workspaceId: string\): Promise<boolean>

  pushInvoice\(doc: ParsedDocument\): Promise<ExternalRef>

  pushExpense\(doc: ParsedDocument\): Promise<ExternalRef>

  listContacts\(\): Promise<Contact\[\]>

  listAccounts\(\): Promise<ChartOfAccount\[\]>

\}

### C\.2\.2  integrations Table

__Column__

__Type__

__Notes__

id

uuid \(PK\)

workspace\_id

uuid \(FK\)

provider

text

quickbooks | xero | zoho

access\_token

text \(encrypted\)

Encrypted with workspace\-scoped key

refresh\_token

text \(encrypted\)

token\_expiry

timestamptz

tenant\_id

text

QuickBooks realm\_id or Xero tenant\_id

config

jsonb

Provider\-specific: default account IDs, tax codes

synced\_at

timestamptz

Last successful push

status

text

active | expired | error

*📝 Agent instruction: Encrypt access\_token and refresh\_token using pgcrypto \(pgp\_sym\_encrypt\) with a secret stored in Supabase Vault\. Never store tokens in plain text\.*

## C\.3  OAuth 2\.0 Flow \(All Providers\)

1. User clicks Connect in IntegrationsPage\.vue\.
2. Frontend calls GET /api/integrations/\{provider\}/auth\-url\.
3. Server route builds the provider\-specific OAuth URL with state=workspaceId:nonce\.
4. User is redirected to the provider's consent screen\.
5. Provider redirects to /api/integrations/\{provider\}/callback?code=\.\.\.&state=\.\.\.
6. Server route exchanges the code for tokens, encrypts them, upserts into integrations table\.
7. Frontend polls GET /api/integrations/\{provider\}/status until status = active\.
8. Frontend shows Connected badge and configuration options\.

## C\.4  QuickBooks Online Integration

### C\.4\.1  Credentials Required

- Client ID and Client Secret from Intuit Developer portal\.
- Scopes: com\.intuit\.quickbooks\.accounting
- Redirect URI: https://\{domain\}/api/integrations/quickbooks/callback

### C\.4\.2  Push Invoice Implementation

// server/integrations/quickbooks\.adapter\.ts

async pushInvoice\(doc: ParsedDocument\): Promise<ExternalRef> \{

  const token = await this\.getValidToken\(\)

  const payload = \{

    Line: doc\.items\.map\(item => \(\{

      Amount: item\.amount,

      DetailType: 'SalesItemLineDetail',

      SalesItemLineDetail: \{

        ItemRef: \{ value: '1' \},  // map from config\.default\_item\_id

        UnitPrice: item\.unit\_price,

        Qty: item\.quantity

      \}

    \}\)\),

    CustomerRef: \{ value: await this\.resolveVendor\(doc\.vendor\_name\) \},

    TxnDate: doc\.document\_date,

    DocNumber: doc\.invoice\_number

  \}

  const res = await fetch\(

    \`https://quickbooks\.api\.intuit\.com/v3/company/$\{this\.tenantId\}/invoice\`,

    \{ method: 'POST', headers: \{ Authorization: \`Bearer $\{token\}\` \}, body: JSON\.stringify\(payload\) \}

  \)

  const data = await res\.json\(\)

  return \{ provider: 'quickbooks', external\_id: data\.Invoice\.Id \}

\}

## C\.5  Xero Integration

### C\.5\.1  Credentials Required

- Client ID and Client Secret from Xero Developer portal\.
- Scopes: openid profile email accounting\.transactions accounting\.contacts
- Redirect URI: https://\{domain\}/api/integrations/xero/callback

### C\.5\.2  Key Differences from QuickBooks

- Xero uses tenant\_id \(organisation UUID\) in every API request header: Xero\-tenant\-id\.
- Xero line amounts can be EXCLUSIVE or INCLUSIVE of tax; set LineAmountTypes accordingly\.
- Use PUT /api\.xero\.com/api\.xro/2\.0/Invoices for both create and update \(idempotent\)\.
- Xero refresh tokens expire after 60 days of inactivity; implement a nightly token\-refresh cron\.

## C\.6  Zoho Books Integration

### C\.6\.1  Credentials Required

- Client ID and Client Secret from Zoho API Console\.
- Scopes: ZohoBooks\.invoices\.CREATE ZohoBooks\.expenses\.CREATE ZohoBooks\.contacts\.READ
- Redirect URI: https://\{domain\}/api/integrations/zoho/callback
- Note: Zoho requires a separate API domain per data centre \(e\.g\. books\.zoho\.eu for EU\)\.

### C\.6\.2  Key Differences

- Zoho API uses organisation\_id \(numeric string\) rather than a UUID tenant\.
- Expense creation maps to POST /api/books/v3/expenses \(not invoices\)\.
- Zoho enforces per\-API\-call rate limits; implement exponential back\-off with a retry queue\.

## C\.7  Sync Engine

A background sync engine handles pushing documents to accounting platforms reliably:

### C\.7\.1  sync\_jobs Table

__Column__

__Type__

__Notes__

id

uuid \(PK\)

document\_id

uuid \(FK\)

provider

text

Target accounting platform

status

text

queued | running | success | failed

attempts

int

Default 0; max 3

last\_error

text

Error message from last attempt

external\_id

text

Set on success

queued\_at

timestamptz

DEFAULT now\(\)

processed\_at

timestamptz

Set on terminal state

### C\.7\.2  Processing Logic

1. Document is approved \(status = approved in document\_approvals\)\.
2. A Supabase Database Trigger inserts a row into sync\_jobs for each active integration in the workspace\.
3. A Supabase Edge Function \(sync\-worker\) polls sync\_jobs WHERE status = 'queued' ORDER BY queued\_at LIMIT 10\.
4. For each job: instantiate the correct adapter, call pushInvoice or pushExpense, update status\.
5. On failure: increment attempts; if attempts >= 3, set status = 'failed' and send error notification\.
6. The Edge Function is invoked on a schedule \(every 5 minutes\) via Supabase pg\_cron\.

## C\.8  Integrations UI

### C\.8\.1  IntegrationsPage\.vue

- Display a card for each provider \(QuickBooks, Xero, Zoho Books\) with logo, Connect / Disconnect button, and last\-synced timestamp\.
- On Connect: opens OAuth popup \(window\.open\) and listens for postMessage callback on success\.
- Provide a per\-provider settings panel: default account mapping, tax code, auto\-sync toggle\.
- Show a sync history table: document name, status, external ID, timestamp\.

### C\.8\.2  Manual Push Button

On the DocumentDetailModal\.vue \(from Part A\), add a Push to Accounting dropdown button\. This calls POST /api/integrations/\{provider\}/push with \{ document\_id \} and shows a spinner until the sync\_job reaches a terminal state \(poll every 2 seconds\)\.

## C\.9  Security Requirements for Integrations

- All tokens stored encrypted with pgcrypto; decrypted only in server\-side Edge Functions\.
- OAuth state parameter must include a CSRF nonce validated on callback\.
- Webhook endpoints from accounting providers \(if used for reverse sync\) must verify HMAC signatures\.
- API keys must never be sent to the frontend; all accounting API calls are proxied through Nuxt server routes or Edge Functions\.
- Implement token rotation: refresh tokens 15 minutes before expiry using a scheduled pg\_cron job\.

## C\.10  Agent Execution Checklist — Integrations

1. Define AccountingAdapter interface and ParsedDocument / ExternalRef / Contact / ChartOfAccount types\.
2. Create integrations and sync\_jobs table migrations with RLS\.
3. Implement QuickbooksAdapter, XeroAdapter, ZohoAdapter classes each implementing AccountingAdapter\.
4. Build OAuth server routes for all three providers \(auth\-url and callback\)\.
5. Implement token encryption/decryption using Supabase Vault \+ pgcrypto helper\.
6. Scaffold IntegrationsPage\.vue with provider cards and OAuth popup flow\.
7. Build sync\-worker Edge Function with retry logic\.
8. Configure pg\_cron to invoke sync\-worker every 5 minutes\.
9. Add Push to Accounting button to DocumentDetailModal\.vue\.
10. Implement token\-rotation pg\_cron job\.
11. Write integration tests using nock to mock QuickBooks, Xero, Zoho APIs\.
12. Write Playwright e2e: connect QuickBooks → approve document → verify sync\_job = success\.

# PART D — Cross\-Cutting Concerns & Execution Order

## D\.1  Recommended Build Order for the Agent

To minimise merge conflicts and maximise incremental testability, the agent should implement features in this sequence:

__Sprint__

__Deliverable__

__Depends On__

__Test Gate__

1

DB migrations \(all tables\)

None

Supabase migration passes

2

RBAC \+ workspace CRUD

Sprint 1

usePermissions Vitest suite

3

Invite system \+ Realtime

Sprint 2

Invite e2e \(Playwright\)

4

Approval workflow UI

Sprint 3

State machine unit tests

5

Analytics queries \+ charts

Sprint 1

RPC mock Vitest suite

6

AI narrative \+ budget alerts

Sprint 5

API mock tests

7

PDF export

Sprint 5 \+ 6

Visual snapshot test

8

OAuth \+ adapter scaffold

Sprint 1

OAuth callback unit tests

9

QB / Xero / Zoho adapters

Sprint 8

Nock API mock tests

10

Sync engine \+ UI

Sprint 4 \+ 9

Full e2e integration test

## D\.2  Environment Variables Reference

The agent must ensure all of the following are added to \.env\.example and the production Vercel / Supabase environment:

__Variable__

__Purpose__

SUPABASE\_URL

Supabase project URL

SUPABASE\_SERVICE\_ROLE\_KEY

Server\-side full access \(never expose to client\)

SUPABASE\_ANON\_KEY

Public client key

INVITE\_SECRET

JWT signing secret for workspace invitations

RESEND\_API\_KEY

Email delivery for invitations and alerts

ANTHROPIC\_API\_KEY

Claude API for narrative summaries

QB\_CLIENT\_ID / QB\_CLIENT\_SECRET

QuickBooks OAuth app credentials

XERO\_CLIENT\_ID / XERO\_CLIENT\_SECRET

Xero OAuth app credentials

ZOHO\_CLIENT\_ID / ZOHO\_CLIENT\_SECRET

Zoho Books OAuth credentials

TOKEN\_ENCRYPTION\_KEY

pgcrypto key for token encryption \(32 bytes hex\)

PUPPETEER\_EXECUTABLE\_PATH

Path to Chromium for PDF export

## D\.3  Testing Strategy Summary

__Layer__

__Tool__

__Coverage Targets__

Unit

Vitest

Composables, adapters, state machines, validators

API / Integration

Vitest \+ nock

Server routes, OAuth callbacks, sync engine

Component

Vue Test Utils

All new Vue components \(approval, charts, integrations\)

E2E

Playwright

Invite flow, approval flow, accounting sync flow

Visual

Playwright snapshots

PDF export output, chart renders

## D\.4  Performance & Scalability Notes

- Paginate all document list queries; default page size 50\.
- Add database indexes: documents\(workspace\_id, document\_date\), sync\_jobs\(status, queued\_at\)\.
- Cache analytics RPC results in Pinia for 5 minutes; invalidate on new document upload\.
- Rate\-limit the narrative API route to 10 requests per workspace per hour using Supabase Edge Function middleware\.
- Use Supabase Storage \(not base64 in DB\) for document images; store only the Storage path in the documents table\.

## D\.5  Deliverables Summary

Upon completing all sprints, the agent should have produced the following artefacts:

- 10 Supabase migration files \(\.sql\) for all new tables, RLS policies, indexes, and RPC functions\.
- 3 Supabase Edge Functions: invite, sync\-worker, budget\-alert\.
- 3 accounting adapter classes: QuickbooksAdapter, XeroAdapter, ZohoAdapter\.
- 12 new Nuxt server routes under /server/api/\.
- 15\+ new Vue components across Teams, Insights, and Integrations modules\.
- 5 new Pinia stores: useWorkspace, useTeam, usePermissions, useInsights, useIntegrations\.
- Full test suite: >80% coverage on new code, 3 Playwright e2e flows\.
- Updated \.env\.example and README sections for each integration\.

__End of Implementation Plan__

