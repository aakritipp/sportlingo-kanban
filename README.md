# TaskFlow — Kanban Task Board

A polished, drag-and-drop Kanban board built with React, Supabase, and @dnd-kit.

## Quick Start

### 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Authentication > Settings** and enable **Anonymous Sign-ins**
4. Copy your project URL and anon key from **Settings > API**

### 2. Local Development

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

npm install
npm run dev
```

### 3. Deploy to Vercel

```bash
npm install -g vercel
vercel
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as env vars in Vercel dashboard
```

## Tech Stack

- **React** (Vite) — UI framework
- **Supabase** — Database, Auth (anonymous sign-in), RLS
- **@dnd-kit** — Drag and drop
- **Lucide React** — Icons
- **date-fns** — Date formatting

## Features

- Drag-and-drop Kanban board (To Do, In Progress, In Review, Done)
- Guest authentication (no signup required)
- Row Level Security — each user only sees their own tasks
- Task creation with title, description, priority, due date, labels, assignees
- Team members with avatar colors
- Label system (Bug, Feature, Design, Docs, Urgent)
- Due date indicators (overdue, due soon)
- Search and filter by priority/label
- Board statistics
- Responsive layout
- Loading, empty, and error states
