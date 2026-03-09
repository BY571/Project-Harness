# Project Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app for organizing projects with an interactive graph visualization, per-project tasks/notes/blockers, and tag-based clustering.

**Architecture:** Next.js App Router with Server Actions for mutations, Prisma ORM with SQLite for persistence, D3.js force-directed graph for the dashboard visualization. Single-user, no auth.

**Tech Stack:** Next.js 14, TypeScript, Prisma, SQLite, Tailwind CSS, shadcn/ui, D3.js

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Initialize Next.js with TypeScript and Tailwind**

```bash
cd /home/sebastian/Documents/project-manager
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted. This creates the full scaffold.

**Step 2: Verify it runs**

```bash
npm run dev
```

Expected: Dev server starts on http://localhost:3000, default Next.js page renders.

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables: yes.

**Step 4: Add core shadcn/ui components**

```bash
npx shadcn@latest add button card badge input textarea select dialog dropdown-menu separator tooltip checkbox sheet
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind and shadcn/ui"
```

---

### Task 2: Set Up Prisma and Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Install Prisma**

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider sqlite
```

**Step 2: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String   @default("")
  status      String   @default("not_started") // not_started | in_progress | on_hold | done
  priority    String   @default("medium")       // low | medium | high | urgent
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks    Task[]
  notes    Note[]
  tags     ProjectTag[]

  outgoingRelations ProjectRelation[] @relation("source")
  incomingRelations ProjectRelation[] @relation("target")
}

model Task {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  description String   @default("")
  completed   Boolean  @default(false)
  order       Int      @default(0)
  createdAt   DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Note {
  id        String   @id @default(cuid())
  projectId String
  content   String
  type      String   @default("note") // note | blocker
  resolved  Boolean  @default(false)
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Tag {
  id       String       @id @default(cuid())
  name     String       @unique
  color    String       @default("#6366f1")
  projects ProjectTag[]
}

model ProjectTag {
  projectId String
  tagId     String

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([projectId, tagId])
}

model ProjectRelation {
  id              String  @id @default(cuid())
  sourceProjectId String
  targetProjectId String
  type            String  // follow_up | based_on | related_to
  label           String  @default("")

  source Project @relation("source", fields: [sourceProjectId], references: [id], onDelete: Cascade)
  target Project @relation("target", fields: [targetProjectId], references: [id], onDelete: Cascade)

  @@unique([sourceProjectId, targetProjectId])
}
```

**Step 3: Create the Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4: Generate client and run migration**

```bash
npx prisma migrate dev --name init
```

**Step 5: Add `prisma/dev.db` to `.gitignore`**

Append to `.gitignore`:
```
prisma/dev.db
prisma/dev.db-journal
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with all models and SQLite database"
```

---

### Task 3: Server Actions — Projects CRUD

**Files:**
- Create: `src/lib/actions/projects.ts`
- Create: `src/types/index.ts`

**Step 1: Define shared types**

Create `src/types/index.ts`:

```typescript
export type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "done";
export type ProjectPriority = "low" | "medium" | "high" | "urgent";
export type NoteType = "note" | "blocker";
export type RelationType = "follow_up" | "based_on" | "related_to";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  done: "Done",
};

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const RELATION_LABELS: Record<RelationType, string> = {
  follow_up: "Follow-up to",
  based_on: "Based on",
  related_to: "Related to",
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  on_hold: "bg-orange-500",
  done: "bg-green-500",
};

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};
```

**Step 2: Create project server actions**

Create `src/lib/actions/projects.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function getProjects() {
  return db.project.findMany({
    include: {
      tags: { include: { tag: true } },
      tasks: true,
      notes: true,
      outgoingRelations: { include: { target: true } },
      incomingRelations: { include: { source: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      tasks: { orderBy: { order: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      outgoingRelations: { include: { target: true } },
      incomingRelations: { include: { source: true } },
    },
  });
}

export async function createProject(data: {
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  tagIds?: string[];
}) {
  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description ?? "",
      status: data.status ?? "not_started",
      priority: data.priority ?? "medium",
      tags: data.tagIds
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });
  revalidatePath("/");
  return project;
}

export async function updateProject(
  id: string,
  data: {
    name?: string;
    description?: string;
    status?: string;
    priority?: string;
    tagIds?: string[];
  }
) {
  const { tagIds, ...projectData } = data;

  if (tagIds !== undefined) {
    await db.projectTag.deleteMany({ where: { projectId: id } });
    await db.projectTag.createMany({
      data: tagIds.map((tagId) => ({ projectId: id, tagId })),
    });
  }

  const project = await db.project.update({
    where: { id },
    data: projectData,
  });

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return project;
}

export async function deleteProject(id: string) {
  await db.project.delete({ where: { id } });
  revalidatePath("/");
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add project server actions and shared types"
```

---

### Task 4: Server Actions — Tasks, Notes, Tags, Relations

**Files:**
- Create: `src/lib/actions/tasks.ts`
- Create: `src/lib/actions/notes.ts`
- Create: `src/lib/actions/tags.ts`
- Create: `src/lib/actions/relations.ts`

**Step 1: Task actions**

Create `src/lib/actions/tasks.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function createTask(projectId: string, title: string) {
  const maxOrder = await db.task.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  const task = await db.task.create({
    data: { projectId, title, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath(`/projects/${projectId}`);
  return task;
}

export async function updateTask(
  id: string,
  data: { title?: string; description?: string; completed?: boolean; order?: number }
) {
  const task = await db.task.update({ where: { id }, data });
  revalidatePath(`/projects/${task.projectId}`);
  return task;
}

export async function deleteTask(id: string) {
  const task = await db.task.delete({ where: { id } });
  revalidatePath(`/projects/${task.projectId}`);
}
```

**Step 2: Note actions**

Create `src/lib/actions/notes.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function createNote(
  projectId: string,
  content: string,
  type: "note" | "blocker" = "note"
) {
  const note = await db.note.create({ data: { projectId, content, type } });
  revalidatePath(`/projects/${projectId}`);
  return note;
}

export async function updateNote(
  id: string,
  data: { content?: string; resolved?: boolean }
) {
  const note = await db.note.update({ where: { id }, data });
  revalidatePath(`/projects/${note.projectId}`);
  return note;
}

export async function deleteNote(id: string) {
  const note = await db.note.delete({ where: { id } });
  revalidatePath(`/projects/${note.projectId}`);
}
```

**Step 3: Tag actions**

Create `src/lib/actions/tags.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function getTags() {
  return db.tag.findMany({ orderBy: { name: "asc" } });
}

export async function createTag(name: string, color: string = "#6366f1") {
  const tag = await db.tag.create({ data: { name, color } });
  revalidatePath("/");
  return tag;
}

export async function deleteTag(id: string) {
  await db.tag.delete({ where: { id } });
  revalidatePath("/");
}
```

**Step 4: Relation actions**

Create `src/lib/actions/relations.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function createRelation(data: {
  sourceProjectId: string;
  targetProjectId: string;
  type: string;
  label?: string;
}) {
  const relation = await db.projectRelation.create({ data });
  revalidatePath("/");
  revalidatePath(`/projects/${data.sourceProjectId}`);
  revalidatePath(`/projects/${data.targetProjectId}`);
  return relation;
}

export async function deleteRelation(id: string) {
  const relation = await db.projectRelation.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath(`/projects/${relation.sourceProjectId}`);
  revalidatePath(`/projects/${relation.targetProjectId}`);
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add server actions for tasks, notes, tags, and relations"
```

---

### Task 5: App Layout with Sidebar

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/sidebar.tsx`

**Step 1: Update globals.css for dark theme**

Replace `src/app/globals.css` with Tailwind base + dark theme variables from shadcn/ui (keep the existing shadcn/ui CSS variables, add `dark` class to body).

**Step 2: Create the Sidebar component**

Create `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { ProjectStatus } from "@/types";

type SidebarProject = {
  id: string;
  name: string;
  status: string;
};

type SidebarTag = {
  id: string;
  name: string;
  color: string;
};

interface SidebarProps {
  projects: SidebarProject[];
  tags: SidebarTag[];
  onNewProject: () => void;
  activeTagId?: string | null;
  onTagFilter?: (tagId: string | null) => void;
}

export function Sidebar({ projects, tags, onNewProject, activeTagId, onTagFilter }: SidebarProps) {
  const pathname = usePathname();

  const groupedProjects = projects.reduce<Record<string, SidebarProject[]>>((acc, project) => {
    const status = project.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {});

  const statusOrder: ProjectStatus[] = ["in_progress", "not_started", "on_hold", "done"];

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">Project Manager</h1>
      </div>

      <div className="p-3">
        <Button onClick={onNewProject} className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            pathname === "/" && "bg-accent font-medium"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mt-4">
          {statusOrder.map((status) => {
            const group = groupedProjects[status];
            if (!group?.length) return null;
            return (
              <div key={status} className="mb-3">
                <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
                  {STATUS_LABELS[status]}
                </div>
                {group.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent truncate",
                      pathname === `/projects/${project.id}` && "bg-accent font-medium"
                    )}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>

        {tags.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tags
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 py-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={activeTagId === tag.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  style={activeTagId === tag.id ? { backgroundColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                  onClick={() => onTagFilter?.(activeTagId === tag.id ? null : tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
```

**Step 3: Update layout.tsx**

Replace `src/app/layout.tsx` to include the sidebar shell (data fetching happens in a wrapper).

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Manager",
  description: "Organize and visualize your projects",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
```

Create `src/app/(main)/layout.tsx` — this is the layout with the sidebar:

```tsx
import { getProjects } from "@/lib/actions/projects";
import { getTags } from "@/lib/actions/tags";
import { MainLayout } from "@/components/main-layout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [projects, tags] = await Promise.all([getProjects(), getTags()]);

  return (
    <MainLayout
      projects={projects.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      tags={tags}
    >
      {children}
    </MainLayout>
  );
}
```

Create `src/components/main-layout.tsx` — client wrapper that manages sidebar state:

```tsx
"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";

interface MainLayoutProps {
  projects: { id: string; name: string; status: string }[];
  tags: { id: string; name: string; color: string }[];
  children: React.ReactNode;
}

export function MainLayout({ projects, tags, children }: MainLayoutProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  return (
    <div className="flex h-screen">
      <Sidebar
        projects={projects}
        tags={tags}
        onNewProject={() => setShowCreateDialog(true)}
        activeTagId={activeTagId}
        onTagFilter={setActiveTagId}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        tags={tags}
      />
    </div>
  );
}
```

**Step 4: Move pages under (main) route group**

- Move dashboard page to `src/app/(main)/page.tsx`
- Create `src/app/(main)/projects/[id]/page.tsx`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app layout with sidebar navigation"
```

---

### Task 6: Create Project Dialog

**Files:**
- Create: `src/components/projects/create-project-dialog.tsx`

**Step 1: Build the create project form dialog**

Create `src/components/projects/create-project-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createProject } from "@/lib/actions/projects";
import { createTag } from "@/lib/actions/tags";
import type { ProjectStatus, ProjectPriority } from "@/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: { id: string; name: string; color: string }[];
}

export function CreateProjectDialog({ open, onOpenChange, tags }: CreateProjectDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("not_started");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const project = await createProject({
      name: name.trim(),
      description,
      status,
      priority,
      tagIds: selectedTagIds,
    });
    setLoading(false);
    resetForm();
    onOpenChange(false);
    router.push(`/projects/${project.id}`);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const colors = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const tag = await createTag(newTagName.trim(), color);
    setSelectedTagIds([...selectedTagIds, tag.id]);
    setNewTagName("");
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setStatus("not_started");
    setPriority("medium");
    setSelectedTagIds([]);
    setNewTagName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag..."
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>Add</Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add create project dialog with tag management"
```

---

### Task 7: Project Detail Page

**Files:**
- Create: `src/app/(main)/projects/[id]/page.tsx`
- Create: `src/components/projects/task-list.tsx`
- Create: `src/components/projects/note-list.tsx`
- Create: `src/components/projects/connection-list.tsx`
- Create: `src/components/projects/project-header.tsx`

**Step 1: Create the project header**

Create `src/components/projects/project-header.tsx`:

A component showing project name (editable inline), status badge, priority badge, tags. Has buttons to edit status/priority and delete the project.

**Step 2: Create the task list component**

Create `src/components/projects/task-list.tsx`:

A client component with:
- List of tasks with checkboxes
- Input to add a new task
- Click task to edit title inline
- Delete button on hover
- Uses `createTask`, `updateTask`, `deleteTask` server actions

**Step 3: Create the notes & blockers component**

Create `src/components/projects/note-list.tsx`:

A client component with:
- Two tabs or sections: "Notes" and "Blockers"
- Blockers have a red indicator and a "Resolve" button
- Input + type selector to add new note/blocker
- Uses `createNote`, `updateNote`, `deleteNote` server actions

**Step 4: Create the connections component**

Create `src/components/projects/connection-list.tsx`:

A client component showing:
- List of outgoing and incoming relations
- Each shows: relation type label + linked project name (clickable link)
- Form to add: select target project + select relation type
- Delete button per relation
- Uses `createRelation`, `deleteRelation` server actions

**Step 5: Create the project detail page**

Create `src/app/(main)/projects/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/lib/actions/projects";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskList } from "@/components/projects/task-list";
import { NoteList } from "@/components/projects/note-list";
import { ConnectionList } from "@/components/projects/connection-list";
import { getTags } from "@/lib/actions/tags";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const [project, allProjects, allTags] = await Promise.all([
    getProject(params.id),
    getProjects(),
    getTags(),
  ]);

  if (!project) notFound();

  const otherProjects = allProjects.filter((p) => p.id !== project.id);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <ProjectHeader project={project} allTags={allTags} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskList projectId={project.id} tasks={project.tasks} />
        <NoteList projectId={project.id} notes={project.notes} />
      </div>

      <ConnectionList
        projectId={project.id}
        outgoing={project.outgoingRelations}
        incoming={project.incomingRelations}
        otherProjects={otherProjects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add project detail page with tasks, notes, and connections"
```

---

### Task 8: Dashboard Graph Visualization

**Files:**
- Create: `src/components/graph/project-graph.tsx`
- Create: `src/components/graph/graph-tooltip.tsx`
- Modify: `src/app/(main)/page.tsx`

**Step 1: Install D3.js**

```bash
npm install d3 @types/d3
```

**Step 2: Create the graph component**

Create `src/components/graph/project-graph.tsx`:

A client component that:
- Takes projects (with tags and relations) as props
- Renders an SVG with D3 force simulation
- Nodes = projects, colored by status, sized by priority
- Edges = relations, styled by type (solid/dashed/dotted)
- Tag-based clustering using forceX/forceY with tag group positions
- Subtle tag cluster labels/bubbles in the background
- Drag to move nodes, zoom & pan
- Hover shows tooltip with name + status + description
- Click navigates to `/projects/[id]`
- Accepts `activeTagId` prop to highlight/fade nodes

**Step 3: Create the tooltip component**

Create `src/components/graph/graph-tooltip.tsx`:

A positioned div showing project name, status badge, and description snippet.

**Step 4: Create the dashboard page**

Update `src/app/(main)/page.tsx`:

```tsx
import { getProjects } from "@/lib/actions/projects";
import { getTags } from "@/lib/actions/tags";
import { ProjectGraph } from "@/components/graph/project-graph";

export default async function DashboardPage() {
  const [projects, tags] = await Promise.all([getProjects(), getTags()]);

  return (
    <div className="h-full relative">
      <ProjectGraph projects={projects} tags={tags} />
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add D3.js force-directed graph dashboard"
```

---

### Task 9: Polish and Final Integration

**Files:**
- Various touch-ups across components

**Step 1: Add empty states**

- Dashboard: show a friendly "No projects yet" message with a "Create your first project" button when graph is empty
- Project detail sections: show "No tasks yet", "No notes yet", "No connections" placeholders

**Step 2: Add loading states**

- Use Next.js `loading.tsx` files for route transitions
- Add `Suspense` boundaries around data-heavy components

**Step 3: Responsive polish**

- Sidebar collapses to a sheet/drawer on mobile
- Graph fills available space
- Project detail page stacks sections on small screens

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: add empty states, loading states, and responsive polish"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Scaffold Next.js + Tailwind + shadcn/ui |
| 2 | Prisma schema + SQLite + migration |
| 3 | Server actions for Projects CRUD |
| 4 | Server actions for Tasks, Notes, Tags, Relations |
| 5 | App layout with sidebar navigation |
| 6 | Create project dialog |
| 7 | Project detail page (tasks, notes, connections) |
| 8 | Dashboard graph visualization with D3.js |
| 9 | Polish: empty states, loading, responsive |
