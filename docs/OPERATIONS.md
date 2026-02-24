# Forage Bali Todo Platform — Operations Guide

Everything you need to know to update, maintain, or redeploy this platform.

---

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://todo.foragebali.com |
| Vercel fallback | https://forage-bali-todo.vercel.app |

---

## GitHub Repo

**Repo:** https://github.com/isorabins/forage-bali-todo
**Branch:** `main` → auto-deploys to production via Vercel
**Push directly to main** — no PR required for this project.

**Clone with PAT (get token from Iso or ~/.credentials/github.env on VPS):**
```bash
git clone https://<GITHUB_PAT>@github.com/isorabins/forage-bali-todo.git
```

---

## Supabase

**Project URL:** https://uojnuqpfurwgngjqkbjg.supabase.co
**Dashboard:** https://app.supabase.com/project/uojnuqpfurwgngjqkbjg

**Anon key (public — safe in frontend):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvam51cXBmdXJ3Z25nanFrYmpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzgxMzcsImV4cCI6MjA4NjcxNDEzN30.H2ZxY110AVSbwxEc1op3IUjP-h8G0IldptPmAqpyBVk
```

**Service role key (admin — keep private, use in scripts only):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvam51cXBmdXJ3Z25nanFrYmpnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTEzODEzNywiZXhwIjoyMDg2NzE0MTM3fQ.WYJh_mhmaLImhB--RWdroJpMrLDpw7UutHWCA-pXPGs
```

**Tables:**
- `tasks` — all team tasks (the todo list)
- `agents`, `sessions`, `messages`, `blockers`, `files` — OpenClaw/Noko integration (future)

---

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Ant Design + Tailwind CSS
- **Database:** Supabase (Postgres)
- **Hosting:** Vercel (auto-deploy from main)
- **Drag & drop:** dnd-kit

---

## How to Update the Task List

### Option 1: Edit directly in Supabase dashboard
Go to https://app.supabase.com/project/uojnuqpfurwgngjqkbjg/editor
Edit the `tasks` table directly. Changes appear in the UI immediately.

### Option 2: Re-run the seed script
When the plan changes substantially, update `seed.py` and re-run it.
**Warning: this clears all tasks and re-inserts from scratch (status resets).**

```bash
python3 seed.py
```

### Option 3: Add tasks via the UI
The app supports adding/editing tasks directly. Changes save to Supabase in real time.

### Option 4: Ask Alex or Noko
Alex can update tasks via Supabase API. Just describe what you want changed.

---

## Task Fields

| Field | Values | Notes |
|-------|--------|-------|
| `owner` | Iso, Yuka, Carla, Alex | Who owns it |
| `week` | Week 1 – Week 12 | Corresponds to date ranges |
| `month` | Month 1, Month 2, Month 3 | Foundation / Launch / Scale |
| `status` | todo, in-progress, blocked, done | Updated as work happens |
| `priority` | high, normal, low | |
| `title` | string | The task |
| `description` | string | Optional context |

---

## Week → Date Mapping

| Week | Dates |
|------|-------|
| Week 1 | Feb 24 – Mar 1 |
| Week 2 | Mar 2–8 |
| Week 3 | Mar 9–15 |
| Week 4 | Mar 16–22 |
| Week 5 | Mar 23–29 |
| Week 6 | Mar 30 – Apr 5 |
| Week 7 | Apr 6–12 |
| Week 8 | Apr 13–19 |
| Week 9 | Apr 20–26 (🎉 First class Apr 24) |
| Week 10 | Apr 27 – May 3 |
| Week 11 | May 4–10 |
| Week 12 | May 11–17 |

---

## Local Development

```bash
npm install
npm run dev
# → http://localhost:5173
```

Supabase URL and anon key are already in `src/lib/supabase.ts`.

---

## Deployment

Push to `main` — Vercel picks it up automatically within ~60 seconds.

```bash
git add .
git commit -m "your message"
git push origin main
```

---

## VPS Alex

Noko (VPS agent) can read and update this task list via Supabase API.
She uses the service role key above.
Future: Noko will auto-update task statuses as she completes builds.
