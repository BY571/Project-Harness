"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createNote, updateNote, deleteNote } from "@/lib/actions/notes";
import {
  X,
  Plus,
  StickyNote,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteType } from "@/types";

interface Note {
  id: string;
  projectId: string;
  content: string;
  type: string;
  resolved: boolean;
  createdAt: Date;
}

interface NoteListProps {
  projectId: string;
  notes: Note[];
}

export function NoteList({ projectId, notes }: NoteListProps) {
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<NoteType>("note");
  const [isPending, startTransition] = useTransition();

  const blockerCount = notes.filter(
    (n) => n.type === "blocker" && !n.resolved
  ).length;

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;

    setNewContent("");
    startTransition(async () => {
      await createNote(projectId, content, newType);
    });
  };

  const handleResolve = async (id: string) => {
    startTransition(async () => {
      await updateNote(id, { resolved: true });
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      await deleteNote(id);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <StickyNote className="size-4" />
            Notes & Blockers
          </span>
          {blockerCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {blockerCount} blocker{blockerCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No notes yet
          </p>
        )}

        {notes.map((note) => {
          const isBlocker = note.type === "blocker";
          return (
            <div
              key={note.id}
              className={cn(
                "group flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/50",
                isBlocker && !note.resolved && "border-l-2 border-l-red-500",
                isBlocker && note.resolved && "border-l-2 border-l-green-500"
              )}
            >
              <div className="pt-0.5 shrink-0">
                {isBlocker ? (
                  note.resolved ? (
                    <CheckCircle2 className="size-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="size-4 text-red-500" />
                  )
                ) : (
                  <StickyNote className="size-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm break-words",
                    note.resolved && "line-through text-muted-foreground"
                  )}
                >
                  {note.content}
                </p>
                {isBlocker && !note.resolved && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="mt-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleResolve(note.id)}
                  >
                    <CheckCircle2 className="size-3" />
                    Resolve
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(note.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
          );
        })}

        {/* Add note input */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  newType === "note"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setNewType("note")}
              >
                Note
              </button>
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  newType === "blocker"
                    ? "bg-red-500 text-white"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setNewType("blocker")}
              >
                Blocker
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-muted-foreground shrink-0" />
            <Input
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={
                newType === "blocker" ? "Add a blocker..." : "Add a note..."
              }
              className="h-7 text-sm border-none shadow-none focus-visible:ring-0 focus-visible:border-none px-0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
