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
