"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import { createWorkspace, deleteWorkspace } from "@/lib/actions/workspaces";
import type { ProjectStatus } from "@/types";

type SidebarProject = {
  id: string;
  name: string;
  status: string;
  workspaceId?: string | null;
};

type SidebarTag = {
  id: string;
  name: string;
  color: string;
};

type SidebarWorkspace = {
  id: string;
  name: string;
  color: string;
};

const WORKSPACE_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4", "#f97316", "#22c55e",
];

interface SidebarProps {
  projects: SidebarProject[];
  tags: SidebarTag[];
  workspaces: SidebarWorkspace[];
  onNewProject: () => void;
  activeTagId?: string | null;
  onTagFilter?: (tagId: string | null) => void;
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string | null) => void;
  onNavigate?: () => void;
}

export function Sidebar({
  projects,
  tags,
  workspaces,
  onNewProject,
  activeTagId,
  onTagFilter,
  activeWorkspaceId,
  onWorkspaceChange,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const newWorkspaceInputRef = useRef<HTMLInputElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showNewWorkspace && newWorkspaceInputRef.current) {
      newWorkspaceInputRef.current.focus();
    }
  }, [showNewWorkspace]);

  // Filter projects by active workspace
  const filteredProjects = activeWorkspaceId
    ? projects.filter((p) => p.workspaceId === activeWorkspaceId)
    : projects;

  const groupedProjects = filteredProjects.reduce<Record<string, SidebarProject[]>>((acc, project) => {
    const status = project.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {});

  const statusOrder: ProjectStatus[] = ["in_progress", "not_started", "on_hold", "done"];

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    setCreatingWorkspace(true);
    const color = WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length];
    await createWorkspace(name, color);
    setNewWorkspaceName("");
    setShowNewWorkspace(false);
    setCreatingWorkspace(false);
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    // If we're deleting the active workspace, switch to "All"
    if (activeWorkspaceId === workspaceId) {
      onWorkspaceChange?.(null);
    }
    await deleteWorkspace(workspaceId);
  };

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">Project Manager</h1>
      </div>

      {/* Workspace tab bar */}
      <div className="border-b">
        <div
          ref={tabBarRef}
          className="flex items-center gap-0.5 px-2 pt-2 overflow-x-auto scrollbar-none"
        >
          {/* "All" tab */}
          <button
            onClick={() => onWorkspaceChange?.(null)}
            className={cn(
              "shrink-0 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors relative",
              activeWorkspaceId === null
                ? "text-foreground bg-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            All
            {activeWorkspaceId === null && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-foreground" />
            )}
          </button>

          {/* Workspace tabs */}
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => onWorkspaceChange?.(ws.id)}
              className={cn(
                "group shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors relative",
                activeWorkspaceId === ws.id
                  ? "text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: ws.color }}
              />
              <span className="truncate max-w-[80px]">{ws.name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDeleteWorkspace(e as unknown as React.MouseEvent, ws.id); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </span>
              {activeWorkspaceId === ws.id && (
                <div
                  className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
                  style={{ backgroundColor: ws.color }}
                />
              )}
            </button>
          ))}

          {/* Add workspace button */}
          <button
            onClick={() => setShowNewWorkspace(true)}
            className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
            title="New workspace"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Inline new workspace input */}
        {showNewWorkspace && (
          <div className="px-2 pb-2 pt-1 flex items-center gap-1">
            <Input
              ref={newWorkspaceInputRef}
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateWorkspace();
                if (e.key === "Escape") {
                  setShowNewWorkspace(false);
                  setNewWorkspaceName("");
                }
              }}
              placeholder="Workspace name..."
              className="h-7 text-xs"
              disabled={creatingWorkspace}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleCreateWorkspace}
              disabled={creatingWorkspace || !newWorkspaceName.trim()}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5"
              onClick={() => {
                setShowNewWorkspace(false);
                setNewWorkspaceName("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
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
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            pathname === "/" && "bg-accent font-medium"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="mt-4">
          {filteredProjects.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              {activeWorkspaceId
                ? "No projects in this workspace yet."
                : "No projects yet. Create one to get started."}
            </p>
          )}
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
                    onClick={onNavigate}
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
