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
