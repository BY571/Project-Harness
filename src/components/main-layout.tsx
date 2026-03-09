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
