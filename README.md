# Project Manager

A web application for organizing and tracking multiple projects. Features an interactive graph visualization showing how projects relate to each other, with detailed per-project views for tasks, notes, and blockers.

## Features

- **Interactive graph dashboard** -- Force-directed graph showing all projects as nodes, with edges representing relationships (follow-up, based-on, related-to). Nodes are colored by status and sized by priority. Tag-based clustering groups related projects visually.
- **Workspaces** -- Organize projects into separate groups (e.g. "Work", "Side Jobs") using a tab bar. Each workspace filters the sidebar and graph to show only its projects.
- **Project detail view** -- Per-project page with inline-editable name and description, status/priority dropdowns, and tag management.
- **Tasks** -- Checklist of actionable items per project. Add, complete, and delete tasks with optimistic UI updates.
- **Notes and blockers** -- Freeform notes and blocker entries per project. Blockers are visually distinct (red indicator) and can be marked as resolved.
- **Project connections** -- Link projects together with typed relationships: "follow-up to", "based on", or "related to". Connections appear as edges in the graph.
- **Tags** -- Color-coded tags for categorizing projects. Tags drive the clustering in the graph visualization and can be used to filter the view.
- **Responsive design** -- Sidebar collapses to a slide-over drawer on mobile.

## Tech Stack

- **Next.js** (App Router, TypeScript)
- **Prisma** ORM with SQLite
- **Tailwind CSS** with shadcn/ui components
- **D3.js** for the force-directed graph visualization

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/BY571/project-manager.git
cd project-manager
npm install
```

### Database Setup

Generate the Prisma client and run migrations to create the SQLite database:

```bash
npx prisma generate
npx prisma migrate dev
```

### Run

```bash
npm run dev
```

Open http://localhost:3000.

## Usage

1. **Create a workspace** -- Click the "+" button in the workspace tab bar (top of the sidebar) to create a workspace like "Work" or "Side Jobs".
2. **Create a project** -- Click "New Project" in the sidebar. Fill in a name, description, status, priority, and tags. The project is automatically assigned to the active workspace.
3. **Add tasks** -- On the project detail page, type a task title and press Enter. Check off tasks as you complete them.
4. **Add notes and blockers** -- Toggle between "Note" and "Blocker" types, then add entries. Resolve blockers when they are no longer blocking.
5. **Connect projects** -- In the Connections section, link to other projects with a relationship type (follow-up, based-on, related-to).
6. **View the graph** -- Click "Dashboard" in the sidebar to see all projects visualized. Hover for details, click to navigate. Use the tag filter in the sidebar to highlight specific groups.

## Project Structure

```
src/
  app/
    (main)/              # Route group with sidebar layout
      page.tsx           # Dashboard with graph
      projects/[id]/     # Project detail page
  components/
    graph/               # D3 graph visualization
    projects/            # Project-related UI components
    ui/                  # shadcn/ui primitives
  lib/
    actions/             # Server actions (projects, tasks, notes, tags, relations, workspaces)
    db.ts                # Prisma client singleton
  types/                 # Shared TypeScript types
prisma/
  schema.prisma          # Database schema
```
