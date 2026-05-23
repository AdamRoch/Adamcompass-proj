# Product Requirements Document — Compass

**A personal dashboard for tracking projects, learning goals, and curiosity.**

| | |
|---|---|
| **Working title** | Compass |
| **Document version** | 1.0 (draft) |
| **Date** | May 22, 2026 |
| **Author** | (you) |
| **Status** | Draft for review |

---

## 1. Overview

Compass is a single-user personal dashboard that brings together the three things that currently live in scattered places — **active projects**, **learning goals**, and **notes worth keeping**. It is the place you open in the morning to see what you are building, what you are learning, and what you decided not to forget, and the place you return to in order to log progress.

It is deliberately personal. It is not a team tool, not a generic to-do app, and not a knowledge base for its own sake. Every feature exists to answer one of three questions: *What am I making progress on? What am I learning? What was I curious about that I should follow up on?*

### 1.1 The problem

Right now, progress is invisible because it is fragmented. Software projects live in repos, terminals, and an agentic coding pipeline. Learning goals live in browser tabs, a reading list, and good intentions. Notes live in a notes app, sticky notes, and memory. Because nothing aggregates these, it is easy to (a) start a project and quietly abandon it, (b) decide to learn a topic and never follow up, and (c) lose an insight or a curiosity before acting on it.

### 1.2 The solution

A dashboard with three first-class modules — **Projects**, **Learning**, and **Notes** — unified by a home view that surfaces momentum and stalls. The differentiator is that Compass models *how the work actually flows*: a software project moves from raw idea → PRD → build (including overnight agentic builds) → shipped; a learning goal moves from curiosity → in progress → completed, with notes and sources attached along the way.

---

## 2. Goals and non-goals

### 2.1 Goals

- Give a true at-a-glance picture of every active project and learning goal.
- Make logging progress fast enough that it actually happens (seconds, not minutes).
- Surface things that have stalled so they get attention or get consciously dropped.
- Model the idea → PRD → product lifecycle explicitly, including agentic/overnight build runs.
- Keep notes connected to the project or topic they belong to, so they resurface in context.
- Track reading (articles, books) and structured learning lists with visible completion.

### 2.2 Non-goals

- **Not** a team or collaboration tool — single user, no sharing, no permissions.
- **Not** a replacement for a code editor, repo host, or CI system — Compass *links to* and *summarizes* those, it does not run code.
- **Not** a general-purpose note-taking app competing with full PKM tools — notes are scoped to projects and topics.
- **Not** a calendar or time-tracking tool, though it may surface dates.
- **Not** a habit tracker (initially).

---

## 3. Target user

A single primary user (you): a builder who runs multiple software projects in parallel, uses an agentic coding workflow to advance work autonomously, and simultaneously maintains a steady appetite for learning new topics, reading, and exploring ideas. Technically fluent, comfortable with structured tools, and motivated by visible progress.

Design implication: the tool can assume a sophisticated user. It should favor density and speed over hand-holding, and it should not over-explain.

---

## 4. User stories

**Projects**

- As a user, I want to capture a raw idea in seconds so it does not get lost before I can develop it.
- As a user, I want to promote an idea into a structured PRD so I can decide whether to build it.
- As a user, I want to see each project's current lifecycle stage so I know what the next move is.
- As a user, I want to queue and review overnight agentic build runs so I can pick up where the agent left off in the morning.
- As a user, I want to see which projects have not moved in a while so I can revive or retire them.

**Learning**

- As a user, I want to add a topic I am curious about so I have a running list of learning goals.
- As a user, I want to break a topic into sub-goals or a checklist so a vague interest becomes trackable.
- As a user, I want to track articles and books with reading status so my reading list is honest.
- As a user, I want to attach notes and sources to a topic so my learning accumulates in one place.
- As a user, I want to see a completion percentage for a learning goal so progress feels real.

**Notes and the dashboard**

- As a user, I want to jot a note and link it to a project or topic so it resurfaces in context.
- As a user, I want a home view that shows momentum, stalls, and what to do next across everything.

---

## 5. Functional requirements

### 5.1 Home / Dashboard

The default landing view. Read-oriented, scannable, surfaces signal over noise.

- **Momentum strip** — projects and learning goals touched in the last 7 days, with a small progress indicator.
- **Needs attention** — items with no activity past a configurable threshold (default 14 days for projects, 21 for learning goals).
- **Overnight run summary** — results of any agentic build runs since the user last opened the app (see 5.2.4).
- **Quick capture** — a single always-visible input that creates an idea, a note, or a learning topic; type is inferred or picked.
- **This week** — anything with a due/target date in the next 7 days.
- Counts by status (e.g., 4 projects building, 7 topics in progress, 12 unread articles).

### 5.2 Projects module

A project is any initiative the user is actively advancing. Software builds are the primary case, but the module should accommodate non-software projects too.

#### 5.2.1 Project lifecycle stages

Each project has a stage. Default pipeline:

1. **Idea** — captured, not yet developed.
2. **PRD / Spec** — being defined; a structured document is attached.
3. **Building** — actively under construction (manual and/or agentic).
4. **Review / Polish** — functional, being refined.
5. **Shipped** — released or completed.
6. **Archived / Parked** — intentionally set aside (with a reason).

Stages should be customizable per project for non-software work.

#### 5.2.2 Project record

Each project contains: title, one-line summary, stage, status (active / parked / done), tags, created and last-touched dates, optional target date, progress percentage (manual or derived from milestones), links (repo, deployment, design, docs), milestones/tasks, attached notes, and an activity log.

#### 5.2.3 Idea → PRD → product pipeline

- An **Idea** can be promoted to a project with one action.
- A project in the **PRD** stage has an attached spec document — either authored in-app in a structured PRD template (problem, goals, requirements, scope) or linked externally.
- Promoting from PRD to Building creates an initial milestone/task list, optionally seeded from the PRD's requirements.
- The pipeline should be visualizable as a board (columns = stages) and as a list.

#### 5.2.4 Agentic build runs

First-class support for an agentic coding workflow that advances projects autonomously (e.g., overnight).

- A project can have one or more **build runs**, each with: objective/prompt, status (queued / running / completed / failed), start and end time, and an outcome summary.
- The user can **queue a run** against a project with a stated objective before stepping away.
- On the next visit, the Home view's **overnight run summary** shows what completed, what failed, and what changed, with links to the relevant output (PR, branch, deploy).
- Each run produces an entry in the project activity log and can auto-update progress.
- *Integration note:* Compass does not execute builds itself. It records, links to, and summarizes runs. Actual triggering may be via API/webhook to the external agentic workflow (see Section 8). MVP can support manual logging of runs with automation as a fast follow.

#### 5.2.5 Progress tracking

- Progress shown as a percentage and/or milestone completion ratio.
- Activity log per project: stage changes, completed milestones, build runs, notes added.
- Stall detection: flag projects with no activity past the threshold.

### 5.3 Learning module

A learning goal is a topic the user wants to understand or explore.

#### 5.3.1 Learning goal record

Each goal contains: topic title, motivation/why, status (curious / in progress / completed / parked), tags, created and last-touched dates, optional target date, a checklist of sub-topics or learning objectives, attached resources, attached notes, and a completion percentage derived from the checklist.

#### 5.3.2 Topic checklists

- A learning goal can hold an ordered checklist of sub-topics, concepts, or objectives.
- Checking items off drives the completion percentage.
- Checklists can be created manually or from a template.

#### 5.3.3 Reading list (articles and books)

- Track articles and books as resources, each with: title, author/source, URL, type (article / book / paper / video / course / other), reading status (to read / reading / read / abandoned), optional rating, and an optional linked note (takeaways).
- A reading item can be standalone or attached to a learning goal.
- A dedicated reading-list view filterable by status and type.

#### 5.3.4 Curiosity log

- Lightweight capture for "I'm curious about X" entries that are not yet full learning goals.
- A curiosity entry can be promoted to a full learning goal, mirroring Idea → Project.
- Prevents fleeting interests from being lost.

### 5.4 Notes module

Notes capture things worth keeping: insights, decisions, snippets, reminders.

- Each note has: title (optional), body (rich text / markdown), tags, created date, and an optional link to a project or learning goal.
- Notes attached to a project or topic appear within that record *and* in the Notes module.
- Quick capture from the Home view defaults to an unfiled note that can be linked later.
- Search across all note content.

### 5.5 Cross-cutting features

- **Tags** — a shared tag system across projects, learning goals, and notes for cross-domain views (e.g., everything tagged `ai`).
- **Global search** — across project titles/summaries, learning goals, notes, and resources.
- **Filtering and sorting** — by status, stage, tag, last-touched, target date.
- **Activity feed** — a unified, reverse-chronological log of everything that happened.
- **Quick capture** — frictionless creation of an idea, note, topic, or curiosity from anywhere.

---

## 6. Information architecture and data model

Core entities and key relationships:

- **Project** — has many *Milestones*, *Notes*, *BuildRuns*, *ActivityEvents*; has one optional *PRD document*; may originate from an *Idea*.
- **LearningGoal** — has many *ChecklistItems*, *Resources*, *Notes*, *ActivityEvents*; may originate from a *CuriosityEntry*.
- **Note** — belongs optionally to one *Project* or one *LearningGoal*; has many *Tags*.
- **Resource** (article/book/etc.) — belongs optionally to one *LearningGoal*; has a reading status.
- **BuildRun** — belongs to one *Project*; has objective, status, timestamps, outcome summary.
- **Tag** — many-to-many with Projects, LearningGoals, Notes, Resources.
- **ActivityEvent** — typed, timestamped, references the entity it describes; powers the activity feed and stall detection.

Every entity carries `created_at` and `last_touched_at` — the latter is central to momentum and stall detection.

---

## 7. UX principles

- **Capture must be instant.** Adding an idea, note, or topic should take one input and one keypress. Friction here defeats the product.
- **The dashboard answers questions, it does not just display data.** Momentum and stalls are computed, not just listed.
- **Honest, not motivational.** Show real state, including stalled and abandoned items, rather than vanity progress.
- **Two views for collections** — board (pipeline/kanban) and list — for both Projects and Learning.
- **Dense but calm.** A sophisticated single user; favor information density, restrained styling, fast keyboard navigation.
- **Linking is encouraged but never required.** A note can be unfiled; a resource can be standalone; structure is opt-in.

---

## 8. Technical considerations

*(Indicative — to be confirmed against your stack and how you want to build this.)*

- **Platform** — assumed web app first, responsive for mobile capture, with desktop as the primary surface. *(Open question — see Section 11.)*
- **Architecture** — single-user, so a straightforward client + API + relational database is sufficient; no multi-tenancy or permissions needed.
- **Data ownership** — local-first or self-hosted is desirable for a personal tool; data export (JSON / Markdown) should be supported from the start.
- **Agentic workflow integration** — an API/webhook surface so the external overnight coding workflow can (a) be triggered with an objective and (b) post run results back to the relevant project. Define an inbound endpoint for run-status updates and an outbound trigger.
- **Repo/deploy links** — store as plain URLs initially; optional later integration with a repo host to auto-pull commit or PR activity into the project activity log.
- **Search** — full-text search across notes and titles; can start with database-native search.

---

## 9. Scope and phasing

### Phase 1 — MVP

- Projects module with lifecycle stages, project records, milestones, manual progress.
- Learning module with learning goals, topic checklists, and the reading list.
- Notes module with linking to projects/topics.
- Home dashboard with momentum, needs-attention, this-week, and quick capture.
- Tags, global search, activity feed.
- Manual logging of agentic build runs.
- Data export.

### Phase 2 — Pipeline and automation

- Idea → PRD → product pipeline with in-app PRD template and board view.
- Curiosity log with promotion to learning goals.
- Agentic build run automation: trigger runs and receive results via API/webhook.
- Overnight run summary on the dashboard.

### Phase 3 — Enrichment

- Repo/deploy integrations that pull activity automatically.
- Templates for project types and learning checklists.
- Trends over time (progress velocity, completion rates).
- Mobile-optimized quick capture.

---

## 10. Success metrics

Because this is a personal tool, success is measured by behavior, not scale:

- **Engagement** — Compass is opened on most days and is the default first view of the work.
- **Capture rate** — ideas, notes, and curiosities are logged here rather than lost elsewhere.
- **Stall recovery** — flagged stalled items are consistently either revived or consciously archived, rather than ignored.
- **Completion** — a higher share of started projects reach Shipped, and started learning goals reach Completed, than before.
- **Single source of truth** — projects and learning goals are no longer tracked in parallel scattered tools.

---

## 11. Open questions and assumptions

Assumptions made in this draft (flag any that are wrong):

- The app is for a single user with no sharing or collaboration.
- Web-first with a desktop primary surface; mobile is for capture, not deep work.
- Compass records and summarizes agentic build runs but does not execute code itself.
- A local-first or self-hosted approach is acceptable and preferred.

Questions to resolve before build:

1. **Platform** — web, native desktop, mobile, or a combination?
2. **Agentic integration** — what is the specific agentic coding workflow, and does it expose an API/webhook Compass can use?
3. **PRD authoring** — should PRDs be authored fully in-app, or is linking to an external document enough for v1?
4. **Reminders** — should target dates generate active notifications, or only appear passively in "this week"?
5. **Habits** — is recurring/habit tracking wanted later, or firmly out of scope?
6. **Existing data** — is there project or reading-list data to migrate in at launch?
