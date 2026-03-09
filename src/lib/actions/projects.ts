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
