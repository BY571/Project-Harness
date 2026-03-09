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
  activeWorkspaceId?: string | null;
}

export function CreateProjectDialog({ open, onOpenChange, tags, activeWorkspaceId }: CreateProjectDialogProps) {
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
      workspaceId: activeWorkspaceId ?? null,
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
    <Dialog open={open} onOpenChange={(isOpen) => onOpenChange(isOpen)}>
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
