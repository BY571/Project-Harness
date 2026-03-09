"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTask, updateTask, deleteTask } from "@/lib/actions/tasks";
import { X, Plus, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  completed: boolean;
  order: number;
  createdAt: Date;
}

interface TaskListProps {
  projectId: string;
  tasks: Task[];
}

type OptimisticAction =
  | { type: "add"; task: Task }
  | { type: "toggle"; id: string }
  | { type: "delete"; id: string };

export function TaskList({ projectId, tasks: initialTasks }: TaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const [optimisticTasks, dispatch] = useOptimistic(
    initialTasks,
    (state: Task[], action: OptimisticAction) => {
      switch (action.type) {
        case "add":
          return [...state, action.task];
        case "toggle":
          return state.map((t) =>
            t.id === action.id ? { ...t, completed: !t.completed } : t
          );
        case "delete":
          return state.filter((t) => t.id !== action.id);
        default:
          return state;
      }
    }
  );

  const completedCount = optimisticTasks.filter((t) => t.completed).length;

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;

    setNewTitle("");
    const tempTask: Task = {
      id: `temp-${Date.now()}`,
      projectId,
      title,
      description: "",
      completed: false,
      order: optimisticTasks.length,
      createdAt: new Date(),
    };

    startTransition(async () => {
      dispatch({ type: "add", task: tempTask });
      await createTask(projectId, title);
    });
  };

  const handleToggle = async (id: string, completed: boolean) => {
    startTransition(async () => {
      dispatch({ type: "toggle", id });
      await updateTask(id, { completed: !completed });
    });
  };

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      dispatch({ type: "delete", id });
      await deleteTask(id);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTodo className="size-4" />
            Tasks
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {completedCount}/{optimisticTasks.length} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {optimisticTasks.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tasks yet
          </p>
        )}

        {optimisticTasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={task.completed}
              onCheckedChange={() => handleToggle(task.id, task.completed)}
            />
            <span
              className={cn(
                "flex-1 text-sm transition-colors",
                task.completed && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(task.id)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}

        {/* Add task input */}
        <div className="flex items-center gap-2 pt-2">
          <Plus className="size-4 text-muted-foreground shrink-0" />
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add a task..."
            className="h-7 text-sm border-none shadow-none focus-visible:ring-0 focus-visible:border-none px-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
