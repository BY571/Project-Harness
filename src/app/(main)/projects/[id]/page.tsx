import { notFound } from "next/navigation";
import { getProject, getProjects } from "@/lib/actions/projects";
import { ProjectHeader } from "@/components/projects/project-header";
import { TaskList } from "@/components/projects/task-list";
import { NoteList } from "@/components/projects/note-list";
import { ConnectionList } from "@/components/projects/connection-list";
import { getTags } from "@/lib/actions/tags";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, allProjects, allTags] = await Promise.all([
    getProject(id),
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
