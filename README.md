# Grace AI

Grace AI is a multi-tenant AI Voice Calling SaaS platform for inbound/outbound phone automation, campaign execution, customer engagement, scheduling, analytics, and billing.

It combines real-time telephony and AI orchestration with a modern web dashboard:
- Next.js frontend for operations and monitoring
- FastAPI backend for APIs, webhooks, and voice stream coordination
- Celery workers for asynchronous/background workloads

---

## What This Project Does

Grace AI enables teams to:
- Create and manage AI voice agents
- Handle inbound and outbound calls
- Run outbound call campaigns
- Manage customer conversations (call/email/sms context)
- Auto-book and track appointments/jobs
- Analyze performance and usage
- Manage subscription plans and billing

---

## Core Technology Stack

### Main technologies used heavily
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python), SQLAlchemy, Alembic
- **Data:** PostgreSQL, Redis
- **Async processing:** Celery
- **Voice + AI:** Twilio, Deepgram, OpenAI GPT-4o, ElevenLabs
- **Auth + Billing:** Clerk, Stripe
- **Knowledge + Storage:** Pinecone, Cloudflare R2

### Supporting technologies
- Zustand, TanStack Query, Recharts, React Flow, Framer Motion
- Docker / Docker Compose
- Railway + Vercel deployment model

---

## High-Level Architecture

1. User interacts with dashboard (web app)
2. Web calls backend REST/SSE/WebSocket APIs
3. Backend handles org-scoped logic and persistence
4. Twilio webhooks + media streams trigger live voice pipeline
5. AI services (STT/LLM/TTS) drive real-time responses
6. Workers process campaigns and post-call jobs asynchronously

### Architecture Diagram
![System Architecture](_scratch/diagrams/01-01-system-architecture.png)

---

## UI Screenshots

### Homepage
![Homepage 1](_scratch/diagrams/Homepage Screeshots-1.png)
![Homepage 2](_scratch/diagrams/Homepage Screeshots-2.png)
![Homepage 3](_scratch/diagrams/Homepage Screeshots-3.png)
![Homepage 4](_scratch/diagrams/Homepage Screeshots-4.png)
![Homepage 5](_scratch/diagrams/Homepage Screeshots-5.png)
![Homepage 6](_scratch/diagrams/Homepage Screeshots-6.png)

### Dashboard
![Dashboard 1](_scratch/diagrams/Dashboard - 1.png)
![Dashboard 2](_scratch/diagrams/Dashboard - 2.png)
![Dashboard 3](_scratch/diagrams/Dashboard - 3.png)
![Dashboard 4](_scratch/diagrams/Dashboard - 4.png)
![Dashboard 5](_scratch/diagrams/Dashboard - 5.png)
![Dashboard 6](_scratch/diagrams/Dashboard - 6.png)
![Dashboard 7](_scratch/diagrams/Dashboard - 7.png)
![Dashboard 8](_scratch/diagrams/Dashboard - 8.png)
![Dashboard 9](_scratch/diagrams/Dashboard - 9.png)
![Dashboard 10](_scratch/diagrams/Dashboard - 10.png)

### Dashboard Light Theme
![Dashboard Light Theme 1](_scratch/diagrams/Deshboard Light Theme-1.png)
![Dashboard Light Theme 2](_scratch/diagrams/Deshboard Light Theme-2.png)
![Dashboard Light Theme 3](_scratch/diagrams/Deshboard Light Theme-3.png)
![Dashboard Light Theme 4](_scratch/diagrams/Deshboard Light Theme-4.png)
![Dashboard Light Theme 5](_scratch/diagrams/Deshboard Light Theme-5.png)
![Dashboard Light Theme 6](_scratch/diagrams/Deshboard Light Theme-6.png)
![Dashboard Light Theme 7](_scratch/diagrams/Deshboard Light Theme-7.png)
![Dashboard Light Theme 8](_scratch/diagrams/Deshboard Light Theme-8.png)
![Dashboard Light Theme 9](_scratch/diagrams/Deshboard Light Theme-9.png)

---

## How Everything Works

### 1) Authentication and Multi-tenancy
- Clerk JWT (or dev-mode fallback) authenticates users
- Organization (`org_id`) scopes all critical data access
- Middleware/dependencies enforce route protection and tenant boundaries

### 2) Voice Call Pipeline
- Twilio hits webhook for inbound/outbound call setup
- FastAPI creates call records and returns TwiML stream instructions
- Audio stream is transcribed (Deepgram), reasoned (OpenAI), synthesized (ElevenLabs), and streamed back to caller
- Call transcripts and outcomes are persisted and post-processed

### 3) Campaign Pipeline
- Users create campaign with agent + contacts
- Campaign launch enqueues tasks in Celery
- Worker dials contacts via Twilio and updates call/campaign state

### 4) Customer + Inbox + Schedule
- Customers and conversation threads are unified for timeline tracking
- AI/human message events can create/update appointment jobs
- Job status transitions are tracked for operations visibility

### 5) Billing and Plans
- Stripe checkout/portal handles subscription lifecycle
- Stripe webhooks update org plan limits and usage behavior
- Usage endpoints expose limits and consumption to dashboard

---

## Project Structure

```text
apps/
  web/        # Next.js dashboard frontend
  api/        # FastAPI backend, workers, voice pipeline, models, routers
docs/         # Consolidated technical documentation
_scratch/     # Generated docs/diagram artifacts
scripts/      # Utility scripts
```

Important backend locations:
- `apps/api/main.py` - API bootstrap + router registration
- `apps/api/routers/` - feature/API endpoints
- `apps/api/models/` - DB schema models
- `apps/api/workers/` - Celery tasks
- `apps/api/voice/` - real-time voice orchestration

Important frontend locations:
- `apps/web/app/` - route-based pages
- `apps/web/components/` - shared UI
- `apps/web/lib/` - API client/hooks/config

---

## Local Development Quick Start

1. Copy env values from `.env.example`:
   - `apps/api/.env`
   - `apps/web/.env.local`
2. Start data services:
   - `docker-compose up -d postgres redis`
3. Start the full local stack:
   - `bash scripts/restart-all.sh --watch`
   - or `npm run start` from the project root
4. Run API only:
   - `cd apps/api && uvicorn main:app --reload`
5. Run worker only:
   - `cd apps/api && celery -A workers.celery_app worker --loglevel=info -Q campaigns,post_call`
6. Run web only:
   - `cd apps/web && npm run dev`

---

## Deployment Guide

### Prerequisites
- Railway account + CLI
- Vercel account + CLI
- Twilio account and number
- ElevenLabs, Deepgram, OpenAI API keys
- Clerk app (Organizations enabled)
- Stripe products + webhook secret
- Pinecone index (`1536`, cosine)
- Cloudflare R2 bucket

### Steps
1. Provision PostgreSQL + Redis on Railway
2. Deploy FastAPI API service (`apps/api`)
3. Deploy Celery worker service (same image, worker command)
4. Run migrations (`alembic upgrade head`)
5. Configure Twilio webhooks:
   - `POST /webhooks/twilio/inbound`
   - `POST /webhooks/twilio/status`
6. Deploy Next.js on Vercel (`apps/web`)
7. Configure Stripe webhook:
   - `POST /webhooks/stripe`
8. Verify health and key user flows

---

## API and Health Checks

- Health endpoint: `GET /health`
- Example expected response:
  `{"status":"ok","db":"connected","redis":"connected"}`

Recommended post-deploy validations:
- Sign in and org access
- Agent creation/update
- Outbound test call
- Campaign launch
- Live stream updates
- Billing checkout and webhook state update

---

## Monitoring Recommendations

Suggested alert baselines:
- API 5xx error rate > 1% (5 min)
- Voice websocket disconnect rate > 20% (10 min)
- Celery task failures > 5 (10 min)

---

## Diagrams

### 1) System Architecture
![System Architecture](_scratch/diagrams/01-01-system-architecture.png)

### 2) Voice Call Flow
![Voice Call Flow](_scratch/diagrams/02-02-voice-call-flow.png)

### 3) Outbound Campaign Flow
![Outbound Campaign Flow](_scratch/diagrams/03-03-outbound-campaign-flow.png)

### 4) Authentication Flow
![Authentication Flow](_scratch/diagrams/04-05-auth-flow.png)

### 5) Billing Flow
![Billing Flow](_scratch/diagrams/05-06-billing-flow.png)

### 6) Platform Data Flow
![Platform Data Flow](_scratch/diagrams/06-07-data-flow.png)

### 7) Deployment Topology
![Deployment Topology](_scratch/diagrams/07-08-deployment-architecture.png)

### 8) Database ERD
![Database ERD](_scratch/diagrams/08-database-erd-generated.png)

---

## Related Documents

- Consolidated deep documentation: `docs/ALL-IN-ONE.md`


## ⚠️ Disclaimer

This repository and its contents are the intellectual property of the author.
All rights are reserved.

You are not allowed to copy, modify, distribute, or use any part of this project without explicit written permission from the owner.

If you wish to use this project or any part of it, you must first obtain prior authorization.

Unauthorized use, reproduction, or distribution of this code may result in legal action.
