# 🌿 Forage Bali Team Task Board

Mobile-first kanban board for the Forage Bali team.

## Live URLs
- **Production:** https://todo.foragebali.com *(needs DNS — see below)*
- **Vercel fallback:** https://forage-bali-todo.vercel.app
- **Password:** `foragebali2026`

## DNS Setup Required

The `foragebali.com` domain is managed at Hover.com. Add this DNS record:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | `todo` | `cname.vercel-dns.com.` | 3600 |

Once added, `todo.foragebali.com` will go live within ~10 minutes.

## Stack
- React + TypeScript + Vite
- Ant Design (antd) for UI
- Supabase for data storage
- @dnd-kit for drag-and-drop
- Deployed on Vercel

## Features
- 🔐 Password gate (localStorage, no backend needed)
- 📋 Kanban columns: To Do → In Progress → Blocked → Done
- 👤 Filter by owner: Iso / Yuka / Carla / Alex
- 📅 Filter by Week (Week 1–12) and Month (Month 1–3)
- 🎯 Drag cards between columns to update status
- ✏️ Tap any card to edit/delete
- ➕ FAB button to add new tasks
- 🔄 Real-time sync via Supabase realtime
- 📱 Mobile-first design

## Team Colors
- 🔵 Iso — Blue
- 🟢 Yuka — Green  
- 🟠 Carla — Orange
- 🟣 Alex — Purple

## Supabase Schema
```sql
tasks (
  id uuid,
  title text,
  description text,
  owner text,           -- 'Iso', 'Yuka', 'Carla', 'Alex'
  assigned_agent text,  -- legacy field
  status text,          -- 'todo', 'in-progress', 'blocked', 'done'
  priority text,        -- 'high', 'normal', 'low'
  project text,
  week text,            -- 'Week 1' ... 'Week 12'
  month text,           -- 'Month 1', 'Month 2', 'Month 3'
  due_date text,
  created_at timestamptz,
  updated_at timestamptz
)
```

## Re-seed Tasks
```bash
python3 seed.py
```

## Development
```bash
npm install
npm run dev
```

## Deploy
Push to `main` — Vercel auto-deploys.
