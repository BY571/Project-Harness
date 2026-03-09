"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateProject, deleteProject } from "@/lib/actions/projects";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/types";
import type { ProjectStatus, ProjectPriority } from "@/types";
import { Trash2, ChevronDown } from "lucide-react";

interface ProjectTag {
  projectId: string;
  tagId: string;
  tag: { id: string; name: string; color: string };
}

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    description: string;
    status: string;
    priority: string;
    tags: ProjectTag[];
  };
  allTags: { id: string; name: string; color: string }[];
}

export function ProjectHeader({ project, allTags }: ProjectHeaderProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [editingName, setEditingName] = useState(false);
  const [description, setDescription] = useState(project.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [status, setStatus] = useState(project.status as ProjectStatus);
  const [priority, setPriority] = useState(project.priority as ProjectPriority);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    project.tags.map((t) => t.tagId)
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [editingDescription]);

  const saveName = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setName(project.name);
      return;
    }
    await updateProject(project.id, { name: trimmed });
  };

  const saveDescription = async () => {
    setEditingDescription(false);
    if (description === project.description) return;
    await updateProject(project.id, { description });
  };

  const changeStatus = async (newStatus: ProjectStatus) => {
    setStatus(newStatus);
    await updateProject(project.id, { status: newStatus });
  };

  const changePriority = async (newPriority: ProjectPriority) => {
    setPriority(newPriority);
    await updateProject(project.id, { priority: newPriority });
  };

  const toggleTag = async (tagId: string) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(newTagIds);
    await updateProject(project.id, { tagIds: newTagIds });
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteProject(project.id);
    router.push("/");
  };

  return (
    <div className="space-y-4">
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(project.name);
                  setEditingName(false);
                }
              }}
              className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
            />
          ) : (
            <h1
              className="text-2xl font-bold cursor-pointer rounded px-2 -ml-2 py-1 hover:bg-muted transition-colors"
              onClick={() => setEditingName(true)}
            >
              {name}
            </h1>
          )}
        </div>

        <Button
          variant="destructive"
          size="icon-sm"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Status, Priority, Tags row */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="cursor-pointer"
            render={
              <Badge
                className={`${STATUS_COLORS[status]} text-white cursor-pointer`}
              />
            }
          >
            {STATUS_LABELS[status]}
            <ChevronDown className="size-3 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => changeStatus(value as ProjectStatus)}
              >
                <span
                  className={`inline-block size-2 rounded-full ${STATUS_COLORS[value as ProjectStatus]}`}
                />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="cursor-pointer"
            render={
              <Badge
                className={`${PRIORITY_COLORS[priority]} text-white cursor-pointer`}
              />
            }
          >
            {PRIORITY_LABELS[priority]}
            <ChevronDown className="size-3 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Change Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => changePriority(value as ProjectPriority)}
              >
                <span
                  className={`inline-block size-2 rounded-full ${PRIORITY_COLORS[value as ProjectPriority]}`}
                />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Separator */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* Tags */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="xs" />}
          >
            Tags
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Toggle Tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allTags.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No tags available
              </div>
            ) : (
              allTags.map((tag) => (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                >
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  {selectedTagIds.includes(tag.id) && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Active
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedTagIds.map((tagId) => {
          const tag = allTags.find((t) => t.id === tagId);
          if (!tag) return null;
          return (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color }}
              className="text-white"
            >
              {tag.name}
            </Badge>
          );
        })}
      </div>

      {/* Description */}
      {editingDescription ? (
        <Textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDescription(project.description);
              setEditingDescription(false);
            }
          }}
          placeholder="Add a description..."
          className="text-sm"
          rows={3}
        />
      ) : (
        <p
          className="text-sm text-muted-foreground cursor-pointer rounded px-2 -ml-2 py-1 hover:bg-muted transition-colors min-h-[2rem] flex items-center"
          onClick={() => setEditingDescription(true)}
        >
          {description || "Add a description..."}
        </p>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{project.name}&rdquo;? This
              action cannot be undone. All tasks, notes, and connections will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
