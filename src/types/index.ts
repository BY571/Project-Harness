export type ProjectStatus = "not_started" | "in_progress" | "on_hold" | "done";
export type ProjectPriority = "low" | "medium" | "high" | "urgent";
export type NoteType = "note" | "blocker";
export type RelationType = "follow_up" | "based_on" | "related_to";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  done: "Done",
};

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const RELATION_LABELS: Record<RelationType, string> = {
  follow_up: "Follow-up to",
  based_on: "Based on",
  related_to: "Related to",
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  on_hold: "bg-orange-500",
  done: "bg-green-500",
};

export const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  low: "bg-slate-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};
