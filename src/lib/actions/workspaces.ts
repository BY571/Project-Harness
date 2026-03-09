"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function getWorkspaces() {
  return db.workspace.findMany({ orderBy: { order: "asc" } });
}

export async function createWorkspace(name: string, color: string = "#6366f1") {
  const maxOrder = await db.workspace.aggregate({ _max: { order: true } });
  const workspace = await db.workspace.create({
    data: { name, color, order: (maxOrder._max.order ?? -1) + 1 },
  });
  revalidatePath("/");
  return workspace;
}

export async function deleteWorkspace(id: string) {
  // Set all projects in this workspace to have no workspace
  await db.project.updateMany({ where: { workspaceId: id }, data: { workspaceId: null } });
  await db.workspace.delete({ where: { id } });
  revalidatePath("/");
}
