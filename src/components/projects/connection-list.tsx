"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createRelation, deleteRelation } from "@/lib/actions/relations";
import { RELATION_LABELS } from "@/types";
import type { RelationType } from "@/types";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Link2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Relation {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  type: string;
  label: string;
  target?: { id: string; name: string };
  source?: { id: string; name: string };
}

interface ConnectionListProps {
  projectId: string;
  outgoing: Relation[];
  incoming: Relation[];
  otherProjects: { id: string; name: string }[];
}

const RELATION_TYPES: RelationType[] = ["follow_up", "based_on", "related_to"];

export function ConnectionList({
  projectId,
  outgoing,
  incoming,
  otherProjects,
}: ConnectionListProps) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedType, setSelectedType] = useState<RelationType>("related_to");
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async () => {
    if (!selectedProjectId) return;

    startTransition(async () => {
      await createRelation({
        sourceProjectId: projectId,
        targetProjectId: selectedProjectId,
        type: selectedType,
      });
      setSelectedProjectId("");
      setShowForm(false);
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      await deleteRelation(id);
    });
  };

  const totalConnections = outgoing.length + incoming.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Link2 className="size-4" />
            Connections
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {totalConnections} connection{totalConnections !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalConnections === 0 && !showForm && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No connections
          </p>
        )}

        {/* Outgoing relations */}
        {outgoing.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
              Outgoing
            </p>
            {outgoing.map((rel) => (
              <div
                key={rel.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {RELATION_LABELS[rel.type as RelationType] ?? rel.type}
                </Badge>
                <Link
                  href={`/projects/${rel.targetProjectId}`}
                  className="text-sm font-medium text-primary hover:underline truncate"
                >
                  {rel.target?.name ?? "Unknown"}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(rel.id)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Incoming relations */}
        {incoming.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
              Incoming
            </p>
            {incoming.map((rel) => (
              <div
                key={rel.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <ArrowLeft className="size-3.5 text-muted-foreground shrink-0" />
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {RELATION_LABELS[rel.type as RelationType] ?? rel.type}
                </Badge>
                <Link
                  href={`/projects/${rel.sourceProjectId}`}
                  className="text-sm font-medium text-primary hover:underline truncate"
                >
                  {rel.source?.name ?? "Unknown"}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(rel.id)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add connection form */}
        {showForm ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Project
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                      <span className="truncate">{selectedProjectId ? otherProjects.find(p => p.id === selectedProjectId)?.name : "Select project..."}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px] max-h-[200px] overflow-y-auto">
                    {otherProjects.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)}>
                        {p.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Relation
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                      <span>{RELATION_LABELS[selectedType]}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[180px]">
                    {RELATION_TYPES.map((type) => (
                      <DropdownMenuItem key={type} onClick={() => setSelectedType(type)}>
                        {RELATION_LABELS[type]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setSelectedProjectId("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!selectedProjectId || isPending}
              >
                {isPending ? "Adding..." : "Add Connection"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="size-3.5" />
            Add Connection
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
