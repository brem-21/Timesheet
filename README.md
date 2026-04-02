# Clock-It

A full-stack productivity analytics dashboard for software developers. Clock-It unifies time tracking, meeting intelligence, performance insights, and standup reporting by integrating with Jira, Microsoft Teams, Slack, and Apache Kafka.

## Features

- **Jira Time Tracking** — Fetch tickets assigned to you, filter by month/year, track status (todo / in-progress / in-review / done), and export reports as CSV.
- **Meeting Intelligence** — Extract Microsoft Teams meeting transcripts via a browser extension, summarize them with Gemini AI (with an extractive fallback), and auto-generate action items, decisions, and follow-ups.
- **Performance Analytics** — AI-generated performance insights covering time management, delivery, leadership, and communication. Includes historical snapshots and comparison data.
- **Standup Generator** — Auto-generate daily standup summaries and post them directly to Slack or Microsoft Teams via webhooks.
- **Task Management** — Create and track tasks sourced from meeting action items, with status, priority, and assignee hierarchy.
- **Milestones & Professional Development** — Log career milestones and professional development activities (courses, certifications, workshops, etc.).
- **Smart Recommendations** — Event-driven feature usage analytics (via Kafka) that surface underused features based on your activity patterns.
- **Browser Extension** — Firefox/Chrome extension that logs activity and extracts Teams meeting transcripts in the background.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API routes, Node.js |
| Database | PostgreSQL 16 |
| Event Streaming | Apache Kafka |
| AI / Summarization | Google Gemini API, Anthropic Claude SDK |
| Integrations | Jira Cloud REST API, Slack Webhooks, Microsoft Teams Webhooks |
| Scheduling | node-cron |
| DevOps | Docker, docker-compose, pgAdmin 4, Kafka UI |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A Jira Cloud account with API access
- (Optional) A Google Gemini API key for AI-powered meeting summarization
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
| `JIRA_ACCOUNT_ID` | Your Jira account ID |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams webhook URL |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app (e.g. `http://localhost:5000`) |
| `GEMINI_API_KEY` | (Optional) Google Gemini API key |

### 3. Start the stack

```bash
docker-compose up --build
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

## Project Structure

```
Timesheet/
├── docker-compose.yml        # Full local stack (app, postgres, kafka, UIs)
├── K8s/                      # Kubernetes manifests
└── src/
    ├── app/                  # Next.js app router (pages + API routes)
    │   ├── api/              # REST API endpoints
    │   │   ├── jira/         # Jira integration
    │   │   ├── meetings/     # Meeting ingestion & summarization
    │   │   ├── performance/  # Analytics & Slack posting
    │   │   ├── standup/      # Standup generation
    │   │   ├── tasks/        # Task CRUD
    │   │   ├── track/        # Event tracking (Kafka-backed)
    │   │   ├── recommendations/
    │   │   ├── milestones/
    │   │   ├── profdev/
    │   │   └── reminder/
    │   ├── meetings/         # Meeting intelligence UI
    │   ├── performance/      # Performance dashboard UI
    │   ├── tasks/            # Task board UI
    │   ├── standup/          # Standup UI
    │   ├── timelog/          # Time log UI
    │   └── ...
    ├── components/           # Shared React components
    ├── lib/
    │   ├── db.ts             # PostgreSQL client
    │   ├── kafka.ts          # Kafka producer/consumer singletons
    │   ├── schema.sql        # Database schema
    │   └── ...
    └── ...
```

## Architecture Overview

```
Browser Extension
      │  (transcripts + events)
      ▼
Next.js App (port 5000)
      │
      ├── PostgreSQL ◄─── Kafka Consumer (event processing)
      │                        ▲
      └── Kafka Producer ──────┘
                (user events → recommendations)
```

- User events (page views, clicks, feature usage) are produced to Kafka and consumed back to compute feature recommendation scores.
- Meeting transcripts are processed server-side — Gemini AI is used when a key is available, otherwise an extractive summarizer runs as a fallback.
- Jira, Slack, and Teams integrations communicate directly via their respective REST/webhook APIs.

## License

See [LICENSE](LICENSE).
