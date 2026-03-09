import { getProjects } from "@/lib/actions/projects";
import { getTags } from "@/lib/actions/tags";
import { getWorkspaces } from "@/lib/actions/workspaces";
import { MainLayout } from "@/components/main-layout";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [projects, tags, workspaces] = await Promise.all([getProjects(), getTags(), getWorkspaces()]);

  return (
    <MainLayout
      projects={projects.map((p: { id: string; name: string; status: string; workspaceId: string | null }) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        workspaceId: p.workspaceId,
      }))}
      tags={tags}
      workspaces={workspaces.map((w: { id: string; name: string; color: string }) => ({
        id: w.id,
        name: w.name,
        color: w.color,
      }))}
    >
      {children}
    </MainLayout>
  );
}
