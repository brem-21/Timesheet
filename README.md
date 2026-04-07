# Clock-It

A full-stack productivity and time-tracking dashboard for software developers. Clock-It unifies project management, time tracking, meeting intelligence, performance analytics, and standup reporting — integrating with Jira, Microsoft Teams, Slack, and Apache Kafka.

## Features

### Projects (Project-Centric Architecture)
- **Project Dashboard** — Create and manage projects with names, descriptions, and custom colors. Select an active project from the sidebar to scope all views to that context.
- **Project Tasks** — Manage tasks within a project across four statuses: **To Do → In Progress → In Review → Done**. Tasks include descriptions, checklists, priority levels, and assignees.
- **Project Time Logs** — Log time entries directly against a project (with date and description). Timer sessions from the Time Log page can also be linked to any project, automatically persisting to the database.
- **Project Meetings** — Link meeting summaries to a project. View and manage linked/unlinked meetings from the project's Meetings tab.
- **Project Export** — Download a CSV containing all tasks and time logs for a project. Also available from the global Export page.
- **Project Overview** — Stats bar (time logged, task counts by status), completion progress, time-by-date chart, and linked meetings — all scoped to the active project.

### Time Tracking
- **Timer** — Start/stop a timer against any Jira ticket or meeting task. Sessions persist across page reloads.
- **Time Log Page** — View all timer sessions with date range filters, grouped by ticket. Each session can be linked to a project (creating a DB time log entry). Includes CSV export with assignee and reporting metadata.
- **Active Timer Banner** — Persistent banner showing the running timer across all pages.

### Jira Integration
- **Ticket Fetch** — Load tickets assigned to you filtered by month or custom date range.
- **Status Tracking** — Group tickets by status (In Progress, In Review, Done, etc.).
- **Hours Reporting** — Aggregate hours logged per ticket and export as CSV.

### Meeting Intelligence
- **Transcript Ingestion** — Paste meeting transcripts (from MS Teams or any source) and summarize with Google Gemini AI (extractive fallback when no key is set).
- **Action Item Extraction** — Gemini structures extracted tasks with text, priority, assignee, description, and checklist items.
- **Meeting History** — Browse, search, and manage all past meeting summaries.
- **Project Linking** — Link any meeting to a project so it appears in the project's Meetings tab.

### Task Management
- **Meeting Tasks** (`/tasks`) — Tasks extracted from meeting transcripts. Filter by status, priority, source, or assignee. Expand any task to edit description, checklist, status, priority, and project assignment.
- **All Tasks / Jira Tasks** (`/standup`) — Combined view of Jira tickets and meeting tasks. Meeting tasks can be linked to a project inline via a dropdown.
- **Project Linking** — Both pages show a colored project badge on tasks that are linked to a project.

### Performance Analytics
- **Overall View** — AI-generated performance insights (Gemini) covering time management, delivery, leadership, and growth. Includes historical snapshots, milestones, professional development log, and a cross-project summary panel.
- **By Project View** — Select any project to see KPIs (time logged, tasks done/in-progress/in-review/velocity), a task status breakdown with stacked bars, a time-by-date chart, and AI-generated project-specific insights.
- **Time Filters** — Shared presets across both views: This Week, Last Week, This Month, Last Month, This Quarter, Last Quarter, This Year.
- **Projects Summary Panel** — In the Overall view, see all projects ranked by time logged with completion rates and status mini-bars.

### Overview (Analytics)
- **Jira View** — Stat cards (tickets, hours, done, in-review, in-progress), stacked time chart, ticket status/priority charts, and a full ticket table — filtered by custom date range.
- **Project Filter** — Switch to any project to see project-specific stat cards, a time logged chart (from DB time logs), a completion progress bar, and a sortable tasks table — all within the same date range.

### Standup & Reporting
- **Standup Generator** — Combines active Jira tickets and meeting tasks into a single view. One-click send to Slack.
- **Daily Reminder** — Scheduled via `node-cron` (Africa/Accra timezone): midday check-in at 12:00 PM and standup reminder at 3:00 PM, posted to Slack.
- **Export Page** — Separate CSV exports for Jira tickets (by user + period) and project data (tasks + time logs).

### Professional Growth
- **Courses & Quizzes** — Browse learning topics, add course sections (text, links, notes), and take 30-question AI-generated quizzes.
- **Quiz Analytics** — Per-topic performance stats (avg score, best score, trend) surfaced on the Performance page.
- **Daily Assessment** — A quick daily self-assessment to track learning momentum.

### Event Tracking & Recommendations
- **Kafka-Backed Events** — User interactions (page views, feature usage) are published to Kafka and consumed to compute feature recommendation scores.
- **Smart Recommendations** — Surface underused features based on activity patterns.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Node.js |
| Database | PostgreSQL 16 |
| Event Streaming | Apache Kafka |
| AI / Summarization | Google Gemini API, Anthropic Claude SDK |
| Integrations | Jira Cloud REST API, Slack Webhooks, Microsoft Teams Webhooks |
| Scheduling | node-cron |
| DevOps | Docker, docker-compose, pgAdmin 4, Kafka UI |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A Jira Cloud account with API access
- (Optional) A Google Gemini API key for AI-powered summarization and insights
- (Optional) Slack and/or Microsoft Teams webhook URLs for standup delivery

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd Timesheet
```

### 2. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp src/.env.example src/.env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `KAFKA_BROKERS` | Kafka broker address(es) |
| `JIRA_BASE_URL` | Your Jira instance URL |
| `JIRA_EMAIL` | Jira account email |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_ACCOUNT_ID` | Your Jira account ID (optional — auto-fetched from Jira if not set) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams webhook URL |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app (e.g. `http://localhost:5000`) |
| `GEMINI_API_KEY` | Google Gemini API key (for AI summaries and insights) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key (optional, alternative AI provider) |

### 3. Start the stack

```bash
docker compose up --build
```

This starts:
- **App** at `http://localhost:5000`
- **pgAdmin** at `http://localhost:5050` (login: `admin@clockit.dev` / `admin`)
- **Kafka UI** at `http://localhost:8080`

The database schema is initialized automatically from `src/lib/schema.sql` on first run.

### 4. Local development (without Docker)

```bash
cd src
npm install
npm run dev
```

Make sure PostgreSQL and Kafka are running and `DATABASE_URL` / `KAFKA_BROKERS` point to them.

### 5. Kubernetes deployment

Manifests are in the `K8s/` directory. Update `K8s/clockit-secret.yaml` with your credentials, then apply:

```bash
kubectl apply -f K8s/clockit-secret.yaml
kubectl apply -f K8s/postgres.yaml
kubectl apply -f K8s/kafka.yaml
kubectl apply -f K8s/kafka-ui.yaml
kubectl apply -f K8s/pgadmin.yaml
kubectl apply -f K8s/clock-it.yaml
kubectl apply -f K8s/ingress.yaml
```

## Project Structure

```
Timesheet/
├── docker-compose.yml          # Full local stack (app, postgres, kafka, pgAdmin, Kafka UI)
├── K8s/                        # Kubernetes manifests
└── src/
    ├── app/                    # Next.js App Router (pages + API routes)
    │   ├── api/
    │   │   ├── jira/           # Jira ticket & user APIs
    │   │   ├── meetings/       # Meeting ingestion & summarization
    │   │   ├── projects/       # Projects CRUD + tasks, timelogs, meetings, export
    │   │   │   └── [id]/
    │   │   │       ├── tasks/
    │   │   │       ├── timelogs/
    │   │   │       ├── meetings/
    │   │   │       └── export/
    │   │   ├── performance/    # Overall + project performance, Slack posting
    │   │   ├── tasks/          # Meeting tasks CRUD
    │   │   ├── standup/        # Standup Slack posting
    │   │   ├── growth/         # Quiz, course, topic, insights APIs
    │   │   ├── milestones/     # Career milestones
    │   │   ├── profdev/        # Professional development log
    │   │   ├── track/          # Kafka event tracking
    │   │   ├── recommendations/
    │   │   ├── reminder/       # Scheduled standup reminder
    │   │   └── export/         # Jira CSV export
    │   ├── overview/           # Analytics overview (Jira + project filter)
    │   ├── performance/        # Performance dashboard (overall + by project)
    │   ├── projects/           # Project management (tasks, time log, meetings, export)
    │   ├── meetings/           # Meeting intelligence UI
    │   ├── tasks/              # Meeting tasks with project linking
    │   ├── standup/            # All tasks (Jira + meeting) with project linking
    │   ├── timelog/            # Timer sessions with project linking
    │   ├── export/             # Jira + project CSV export
    │   ├── growth/             # Professional growth, quizzes, courses
    │   └── team/               # Team view
    ├── components/
    │   ├── ActiveProjectContext.tsx  # Global active project state (localStorage)
    │   ├── ProjectSidebarSection.tsx # Sidebar project dropdown + sub-tabs
    │   ├── TimerContext.tsx          # Timer state with session persistence
    │   ├── ActiveTimerBanner.tsx     # Persistent timer banner
    │   └── ...
    └── lib/
        ├── db.ts               # PostgreSQL pool
        ├── kafka.ts            # Kafka producer/consumer
        ├── schema.sql          # Full database schema
        ├── projectStore.ts     # Projects + time logs DB layer
        ├── taskStoreServer.ts  # Tasks DB layer (with project_id)
        ├── timerStore.ts       # localStorage timer sessions
        └── ...
```

## Architecture Overview

```
Browser
      │  (transcripts + events)
      ▼
Next.js App (port 5000)
      │
      ├── PostgreSQL ◄──── Kafka Consumer (event processing)
      │   ├── projects      ▲
      │   ├── tasks ────────┘
      │   ├── time_logs   Kafka Producer
      │   ├── summaries        (user events → recommendations)
      │   └── ...
      │
      ├── localStorage (timer sessions, active project)
      │
      └── External APIs
          ├── Jira Cloud REST API
          ├── Slack Webhooks
          ├── MS Teams Webhooks
          └── Google Gemini API
```

**Key data flows:**
- **Active project** is stored in `localStorage` and read by all pages to scope their data.
- **Timer sessions** live in `localStorage`; linking a session to a project writes to the `time_logs` DB table.
- **Meeting tasks** are stored in the `tasks` table with an optional `project_id` foreign key.
- **User events** are produced to Kafka and consumed back to score feature recommendations.
- **AI insights** use Gemini when available; all endpoints fall back to extractive/deterministic summaries.

## License

See [LICENSE](LICENSE).
