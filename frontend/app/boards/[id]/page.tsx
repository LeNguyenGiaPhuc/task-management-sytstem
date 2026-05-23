"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { API_BASE_URL, apiFetch, type AuthUser } from "../../api";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type PriorityFilter = "ALL" | Priority;
type BoardRole = "OWNER" | "ADMIN" | "MEMBER";
type AssigneeFilter = "ALL" | "UNASSIGNED" | string;
type DueFilter = "ALL" | "OVERDUE" | "DUE_SOON" | "NO_DUE";

type User = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
};

type BoardMember = {
  board_id: string;
  user_id: string;
  role?: BoardRole | null;
  project_role?: string | null;
  joined_at?: string | null;
  users: User;
};


type TaskComment = {
  id: string;
  task_id: string;
  user_id?: string | null;
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_avatar_url?: string | null;
};

type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  uploaded_by?: string | null;
  created_at?: string | null;
  users?: User | null;
};

type SubTask = {
  id: string;
  title: string;
  is_completed?: boolean | null;
  order: number;
};

type Task = {
  id: string;
  column_id?: string;
  title: string;
  description?: string | null;
  priority?: Priority | null;
  assignee_id?: string | null;
  due_date?: string | null;
  order: number;
  users?: User | null;
  sub_tasks?: SubTask[];
};

type Column = {
  id: string;
  title: string;
  order?: number;
  tasks: Task[];
};

type BoardData = {
  title: string;
  description?: string | null;
  background?: string | null;
  board_members?: BoardMember[];
  columns?: Column[];
};

type CreatedColumn = Omit<Column, "tasks">;

type TaskUpdate = {
  title: string;
  description: string | null;
  priority: Priority;
  assignee_id: string | null;
  due_date: string | null;
};

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const projectRoles = [
  "Product Manager",
  "Project Manager",
  "Scrum Master",
  "Business Analyst (BA)",
  "UI/UX Designer",
  "Frontend Developer",
  "Backend Developer",
  "Mobile Developer",
  "Fullstack Developer",
  "QA / Tester",
  "DevOps Engineer",
  "Tech Lead / Team Lead",
  "Client / Customer",
];

function normalizeTask(task: Task): Task {
  return {
    ...task,
    sub_tasks: task.sub_tasks || [],
  };
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getAttachmentHref(fileUrl: string) {
  if (fileUrl.startsWith("/uploads/")) return `${API_BASE_URL}${fileUrl}`;
  return fileUrl;
}

function getColorValue(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#f8fafc";
}

function hexToRgb(value: string) {
  const color = getColorValue(value).replace("#", "");
  return {
    r: parseInt(color.slice(0, 2), 16),
    g: parseInt(color.slice(2, 4), 16),
    b: parseInt(color.slice(4, 6), 16),
  };
}

function mixWithWhite(value: string, amount = 0.88) {
  const { r, g, b } = hexToRgb(value);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function getBoardPageBackground(value: string) {
  if (!value) return "#f1f5f9";
  return mixWithWhite(value, 0.9);
}

function getColumnTaskCount(columns: Column[]) {
  return columns.reduce((total, column) => total + column.tasks.length, 0);
}

function getPriorityClass(priority?: Priority | null) {
  if (priority === "URGENT") return "bg-red-50 text-red-700 ring-red-200";
  if (priority === "HIGH") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (priority === "LOW") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function getDueState(dueDate?: string | null): DueFilter | "NORMAL" {
  if (!dueDate) return "NO_DUE";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysUntilDue < 0) return "OVERDUE";
  if (daysUntilDue <= 3) return "DUE_SOON";
  return "NORMAL";
}

function getDueClass(dueDate?: string | null) {
  const state = getDueState(dueDate);
  if (state === "OVERDUE") return "text-red-600";
  if (state === "DUE_SOON") return "text-amber-600";
  return "text-slate-500";
}

function TaskDetailModal({
  task,
  members,
  comments,
  attachments,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onCreateSubTask,
  onToggleSubTask,
  onDeleteSubTask,
  onCreateComment,
  onDeleteComment,
  onCreateAttachment,
  onDeleteAttachment,
}: {
  task: Task;
  members: BoardMember[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  onClose: () => void;
  onSave: (values: TaskUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onCreateSubTask: (title: string) => Promise<void>;
  onToggleSubTask: (subTask: SubTask) => Promise<void>;
  onDeleteSubTask: (subTaskId: string) => Promise<void>;
  onCreateComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onCreateAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<Priority>(task.priority || "MEDIUM");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task.due_date));
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isAddingSubTask, setIsAddingSubTask] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);

  const completedCount = (task.sub_tasks || []).filter((item) => item.is_completed).length;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSubTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = subTaskTitle.trim();
    if (!trimmedTitle) return;

    setIsAddingSubTask(true);
    try {
      await onCreateSubTask(trimmedTitle);
      setSubTaskTitle("");
    } finally {
      setIsAddingSubTask(false);
    }
  };

  const handleCreateComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentContent.trim();
    if (!content) return;

    setIsAddingComment(true);
    try {
      await onCreateComment(content);
      setCommentContent("");
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleCreateAttachment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attachmentFile) return;

    setIsAddingAttachment(true);
    try {
      await onCreateAttachment(attachmentFile);
      setAttachmentFile(null);
    } finally {
      setIsAddingAttachment(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      await onDuplicate();
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task detail
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="grid gap-4">
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Assignee</span>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.users.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting" : "Delete"}
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={isDuplicating}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDuplicating ? "Copying" : "Duplicate"}
              </button>
            </div>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>

        <section className="mt-6 border-t border-slate-200 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-950">Checklist</h3>
            <span className="text-sm text-slate-500">
              {completedCount}/{task.sub_tasks?.length || 0}
            </span>
          </div>

          <div className="mb-3 grid gap-2">
            {(task.sub_tasks || []).map((subTask) => (
              <div
                key={subTask.id}
                className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={Boolean(subTask.is_completed)}
                  onChange={() => onToggleSubTask(subTask)}
                  className="h-4 w-4 accent-slate-900"
                />
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    subTask.is_completed ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {subTask.title}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteSubTask(subTask.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateSubTask} className="flex gap-2">
            <input
              value={subTaskTitle}
              onChange={(event) => setSubTaskTitle(event.target.value)}
              placeholder="Add checklist item"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              disabled={isAddingSubTask || !subTaskTitle.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </section>

        <section className="mt-6 grid gap-5 border-t border-slate-200 pt-5 md:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">Comments</h3>
              <span className="text-sm text-slate-500">{comments.length}</span>
            </div>

            <form onSubmit={handleCreateComment} className="mb-3 grid gap-2">
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="Write a comment"
                className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="submit"
                disabled={isAddingComment || !commentContent.trim()}
                className="justify-self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingComment ? "Posting" : "Post comment"}
              </button>
            </form>

            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.user_name || "Demo User"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDateTime(comment.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteComment(comment.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400">
                  No comments yet
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">Attachments</h3>
              <span className="text-sm text-slate-500">{attachments.length}</span>
            </div>

            <form onSubmit={handleCreateAttachment} className="mb-3 grid gap-2">
              <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center hover:bg-slate-100">
                <span className="text-sm font-semibold text-slate-800">
                  {attachmentFile ? attachmentFile.name : "Choose file from computer"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {attachmentFile
                    ? `${Math.max(1, Math.round(attachmentFile.size / 1024))} KB selected`
                    : "Maximum upload size: 10 MB"}
                </span>
                <input
                  type="file"
                  onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
              <button
                type="submit"
                disabled={isAddingAttachment || !attachmentFile}
                className="justify-self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingAttachment ? "Uploading" : "Upload file"}
              </button>
            </form>

            <div className="grid max-h-64 gap-2 overflow-y-auto">
              {attachments.length > 0 ? (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={getAttachmentHref(attachment.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {attachment.file_name}
                      </a>
                      <p className="text-[11px] text-slate-500">
                        {attachment.users?.name || "Demo User"} / {formatDateTime(attachment.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(attachment.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400">
                  No attachments yet
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type BoardWorkspaceProps = {
  id: string;
  embedded?: boolean;
};

export function BoardWorkspace({
  id,
  embedded = false,
}: BoardWorkspaceProps) {
  const [boardName, setBoardName] = useState("Loading...");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardBackground, setBoardBackground] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [columnTitle, setColumnTitle] = useState("");
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberProjectRole, setMemberProjectRole] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingColumn, setIsSavingColumn] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [savingColumnId, setSavingColumnId] = useState<string | null>(null);
  const [savingTaskColumnId, setSavingTaskColumnId] = useState<string | null>(null);
  const isBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const selectedTask =
    columns.flatMap((column) => column.tasks).find((task) => task.id === selectedTaskId) || null;
  const currentMember = boardMembers.find((member) => member.user_id === currentUser?.id);
  const currentRole = currentMember?.role || null;
  const canManageBoard = currentRole === "OWNER" || currentRole === "ADMIN";
  const canManageMembers = canManageBoard;
  const canManageColumns = canManageBoard;

  const isFiltering =
    query.trim().length > 0 ||
    priorityFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    dueFilter !== "ALL";
  const totalTasks = getColumnTaskCount(columns);
  const urgentTasks = columns
    .flatMap((column) => column.tasks)
    .filter((task) => task.priority === "URGENT").length;
  const visibleColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => {
        const matchesQuery =
          !normalizedQuery ||
          `${task.title} ${task.description || ""}`.toLowerCase().includes(normalizedQuery);
        const matchesPriority =
          priorityFilter === "ALL" || task.priority === priorityFilter;
        const matchesAssignee =
          assigneeFilter === "ALL" ||
          (assigneeFilter === "UNASSIGNED" && !task.assignee_id) ||
          task.assignee_id === assigneeFilter;
        const dueState = getDueState(task.due_date);
        const matchesDue =
          dueFilter === "ALL" ||
          dueState === dueFilter;

        return matchesQuery && matchesPriority && matchesAssignee && matchesDue;
      }),
    }));
  }, [assigneeFilter, columns, dueFilter, priorityFilter, query]);

  const updateTaskInColumns = (updatedTask: Task) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === updatedTask.id ? normalizeTask(updatedTask) : task
        ),
      }))
    );
  };

  const removeTaskFromColumns = (taskId: string) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => task.id !== taskId),
      }))
    );
  };

  const updateSubTasksInColumns = (taskId: string, subTasks: SubTask[]) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === taskId ? { ...task, sub_tasks: subTasks } : task
        ),
      }))
    );
  };

  const fetchBoardData = useCallback(async () => {
    const [boardResponse, usersResponse, meResponse] = await Promise.all([
      apiFetch(`/api/boards/${id}`),
      apiFetch("/api/users"),
      apiFetch("/api/auth/me"),
    ]);

    if (!boardResponse.ok || !usersResponse.ok || !meResponse.ok) {
      throw new Error("Load board failed");
    }

    const boardData = (await boardResponse.json()) as BoardData;
    const userData = (await usersResponse.json()) as User[];
    const meData = (await meResponse.json()) as { user: AuthUser };

    setBoardName(boardData.title);
    setBoardDescription(boardData.description || "");
    setBoardBackground(boardData.background || "");
    setBoardMembers(boardData.board_members || []);
    setUsers(userData);
    setCurrentUser(meData.user);
    setColumns(
      (boardData.columns || []).map((column) => ({
        ...column,
        tasks: column.tasks.map(normalizeTask),
      }))
    );
    setError("");
  }, [id]);

  useEffect(() => {
    let isActive = true;

    // Client-side board hydration after Next resolves the dynamic route params.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBoardData().catch(() => {
      if (isActive) setError("Could not load board. Check backend and try again.");
    });

    return () => {
      isActive = false;
    };
  }, [fetchBoardData]);

  const fetchTaskExtras = useCallback(async (taskId: string) => {
    const [commentsResponse, attachmentsResponse] = await Promise.all([
      apiFetch(`/api/tasks/${taskId}/comments`),
      apiFetch(`/api/tasks/${taskId}/attachments`),
    ]);

    if (!commentsResponse.ok || !attachmentsResponse.ok) {
      throw new Error("Load task extras failed");
    }

    const comments = (await commentsResponse.json()) as TaskComment[];
    const attachments = (await attachmentsResponse.json()) as TaskAttachment[];

    setTaskComments(comments);
    setTaskAttachments(attachments);
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }

    let isActive = true;

    // Load task-side resources only after a card is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTaskExtras(selectedTaskId).catch(() => {
      if (isActive) setError("Could not load task comments or attachments.");
    });

    return () => {
      isActive = false;
    };
  }, [fetchTaskExtras, selectedTaskId]);

  const handleCreateColumn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    const title = columnTitle.trim();
    if (!title) return;

    setError("");
    setIsSavingColumn(true);

    try {
      const res = await apiFetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: id, title }),
      });

      if (!res.ok) throw new Error("Create column failed");

      const column = (await res.json()) as CreatedColumn;
      setColumns((currentColumns) => [...currentColumns, { ...column, tasks: [] }]);
      setColumnTitle("");
      await fetchBoardData();
    } catch {
      setError("Could not create column. Check backend and try again.");
    } finally {
      setIsSavingColumn(false);
    }
  };

  const handleRenameColumn = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    const title = editingColumnTitle.trim();
    if (!title) return;

    setSavingColumnId(columnId);
    setError("");

    try {
      const res = await apiFetch(`/api/columns/${columnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error("Rename column failed");

      const updatedColumn = (await res.json()) as CreatedColumn;
      setColumns((currentColumns) =>
        currentColumns.map((column) =>
          column.id === updatedColumn.id ? { ...column, title: updatedColumn.title } : column
        )
      );
      setEditingColumnId(null);
      setEditingColumnTitle("");
      await fetchBoardData();
    } catch {
      setError("Could not rename column. Try again.");
    } finally {
      setSavingColumnId(null);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!canManageColumns) {
      setError("Only admins and owners can manage columns.");
      return;
    }

    setDeletingColumnId(columnId);
    setError("");

    try {
      const res = await apiFetch(`/api/columns/${columnId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete column failed");

      setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId));
      await fetchBoardData();
    } catch {
      setError("Could not delete column. Try again.");
    } finally {
      setDeletingColumnId(null);
    }
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) {
      setError("Only admins and owners can manage members.");
      return;
    }

    const trimmedName = memberName.trim();
    if (!trimmedName || !memberProjectRole) return;

    setIsAddingMember(true);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_name: trimmedName,
          project_role: memberProjectRole,
        }),
      });

      if (!res.ok) throw new Error("Add member failed");

      setMemberName("");
      setMemberProjectRole("");
      await fetchBoardData();
    } catch {
      setError("Could not add member. Try again.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!canManageMembers) {
      setError("Only admins and owners can manage members.");
      return;
    }

    setRemovingMemberId(userId);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Remove member failed");

      await fetchBoardData();
    } catch {
      setError("Could not remove member. Owners cannot be removed.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const openSettings = () => {
    if (!canManageBoard) {
      setError("Only admins and owners can change board settings.");
      return;
    }

    setSettingsTitle(boardName);
    setSettingsDescription(boardDescription);
    setIsSettingsOpen(true);
    setError("");
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageBoard) {
      setError("Only admins and owners can change board settings.");
      return;
    }

    if (!settingsTitle.trim()) return;

    setIsSavingSettings(true);
    setError("");

    try {
      const res = await apiFetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settingsTitle.trim(),
          description: settingsDescription.trim() || null,
          background: boardBackground || null,
        }),
      });

      if (!res.ok) throw new Error("Update board failed");

      setIsSettingsOpen(false);
      await fetchBoardData();
    } catch {
      setError("Could not save board settings. Try again.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();

    const title = taskTitles[columnId]?.trim();
    if (!title) return;

    setError("");
    setSavingTaskColumnId(columnId);

    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_id: columnId,
          title,
          priority: "MEDIUM",
        }),
      });

      if (!res.ok) throw new Error("Create task failed");

      const task = normalizeTask((await res.json()) as Task);

      setColumns((currentColumns) =>
        currentColumns.map((column) =>
          column.id === columnId ? { ...column, tasks: [...column.tasks, task] } : column
        )
      );
      setTaskTitles((currentTitles) => ({ ...currentTitles, [columnId]: "" }));
      await fetchBoardData();
    } catch {
      setError("Could not create task. Check backend and try again.");
    } finally {
      setSavingTaskColumnId(null);
    }
  };

  const handleSaveTask = async (values: TaskUpdate) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      setError("Could not save task. Try again.");
      return;
    }

    const updatedTask = normalizeTask((await res.json()) as Task);
    updateTaskInColumns(updatedTask);
    setError("");
    await fetchBoardData();
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete task. Try again.");
      return;
    }

    removeTaskFromColumns(selectedTask.id);
    setSelectedTaskId(null);
    setError("");
    await fetchBoardData();
  };

  const handleDuplicateTask = async () => {
    if (!selectedTask) return;

    const column = columns.find((item) => item.tasks.some((task) => task.id === selectedTask.id));
    if (!column) return;

    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: column.id,
        title: `${selectedTask.title} Copy`,
        description: selectedTask.description || null,
        priority: selectedTask.priority || "MEDIUM",
        assignee_id: selectedTask.assignee_id || null,
        due_date: selectedTask.due_date || null,
      }),
    });

    if (!res.ok) {
      setError("Could not duplicate task. Try again.");
      return;
    }

    const duplicatedTask = normalizeTask((await res.json()) as Task);
    setColumns((currentColumns) =>
      currentColumns.map((item) =>
        item.id === column.id ? { ...item, tasks: [...item.tasks, duplicatedTask] } : item
      )
    );
    setError("");
    await fetchBoardData();
  };

  const handleCreateSubTask = async (title: string) => {
    if (!selectedTask) return;

    const res = await apiFetch("/api/subtasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: selectedTask.id, title }),
    });

    if (!res.ok) {
      setError("Could not create checklist item. Try again.");
      return;
    }

    const subTask = (await res.json()) as SubTask;
    updateSubTasksInColumns(selectedTask.id, [...(selectedTask.sub_tasks || []), subTask]);
    setError("");
    await fetchBoardData();
  };

  const handleToggleSubTask = async (subTask: SubTask) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/subtasks/${subTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: !subTask.is_completed }),
    });

    if (!res.ok) {
      setError("Could not update checklist. Try again.");
      return;
    }

    const updatedSubTask = (await res.json()) as SubTask;
    updateSubTasksInColumns(
      selectedTask.id,
      (selectedTask.sub_tasks || []).map((item) =>
        item.id === updatedSubTask.id ? updatedSubTask : item
      )
    );
    setError("");
    await fetchBoardData();
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/subtasks/${subTaskId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete checklist item. Try again.");
      return;
    }

    updateSubTasksInColumns(
      selectedTask.id,
      (selectedTask.sub_tasks || []).filter((item) => item.id !== subTaskId)
    );
    setError("");
    await fetchBoardData();
  };

  const handleCreateComment = async (content: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      setError("Could not post comment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/comments/${commentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete comment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleCreateAttachment = async (file: File) => {
    if (!selectedTask) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/attachments`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setError("Could not add attachment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedTask) return;

    const res = await apiFetch(`/api/tasks/${selectedTask.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete attachment. Try again.");
      return;
    }

    await fetchTaskExtras(selectedTask.id);
    await fetchBoardData();
    setError("");
  };

  const onDragEnd = async (result: DropResult) => {
    if (isFiltering) {
      setError("Clear search/filter before reordering tasks.");
      return;
    }

    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "COLUMN") {
      if (!canManageColumns) {
        setError("Only admins and owners can reorder columns.");
        return;
      }

      const newColumns = Array.from(columns);
      const [movedColumn] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, movedColumn);
      setColumns(newColumns);

      let newOrder = 1000;
      if (newColumns.length > 1) {
        if (destination.index === 0) {
          newOrder = (newColumns[1].order || 1000) / 2;
        } else if (destination.index === newColumns.length - 1) {
          newOrder = (newColumns[newColumns.length - 2].order || 1000) + 1000;
        } else {
          newOrder =
            ((newColumns[destination.index - 1].order || 1000) +
              (newColumns[destination.index + 1].order || 1000)) /
            2;
        }
      }

      try {
        const res = await apiFetch(`/api/columns/${draggableId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newOrder }),
        });

        if (!res.ok) throw new Error("Move column failed");
        await fetchBoardData();
      } catch {
        setError("Could not save column position. Try again.");
      }

      return;
    }

    const sourceColIndex = columns.findIndex((column) => column.id === source.droppableId);
    const destColIndex = columns.findIndex((column) => column.id === destination.droppableId);

    if (sourceColIndex === -1 || destColIndex === -1) return;

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];
    const newColumns = [...columns];
    let destTasks: Task[] = Array.from(destCol.tasks);

    if (sourceCol.id === destCol.id) {
      const newTasks: Task[] = Array.from(sourceCol.tasks);
      const [movedTask] = newTasks.splice(source.index, 1);
      newTasks.splice(destination.index, 0, movedTask);
      newColumns[sourceColIndex] = { ...sourceCol, tasks: newTasks };
      destTasks = newTasks;
    } else {
      const sourceTasks: Task[] = Array.from(sourceCol.tasks);
      const [movedTask] = sourceTasks.splice(source.index, 1);
      destTasks.splice(destination.index, 0, movedTask);
      newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
      newColumns[destColIndex] = { ...destCol, tasks: destTasks };
    }

    setColumns(newColumns);

    let newOrder = 1000;
    if (destTasks.length > 1) {
      if (destination.index === 0) {
        newOrder = destTasks[1].order / 2;
      } else if (destination.index === destTasks.length - 1) {
        newOrder = destTasks[destTasks.length - 2].order + 1000;
      } else {
        newOrder =
          (destTasks[destination.index - 1].order +
            destTasks[destination.index + 1].order) /
          2;
      }
    }

    try {
      const res = await apiFetch(`/api/tasks/${draggableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_id: destination.droppableId,
          order: newOrder,
        }),
      });

      if (!res.ok) throw new Error("Move task failed");
      await fetchBoardData();
    } catch {
      setError("Could not save task position. Try again.");
    }
  };

  const pageBackground = embedded ? "#f6f8fb" : getBoardPageBackground(boardBackground);
  const headerClass = embedded
    ? "border-b border-slate-200 bg-white px-6 py-5"
    : "border-b border-slate-200 bg-white px-6 py-5";
  const inputClass = embedded
    ? "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    : "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
  const smallInputClass = embedded
    ? "min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    : "min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
  const panelClass = embedded
    ? "rounded-lg border border-slate-200 bg-white p-3"
    : "rounded-lg border border-slate-200 bg-slate-50 p-3";
  const innerCardClass = embedded
    ? "rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
    : "rounded-md border border-slate-200 bg-white px-3 py-2";
  const columnClass = embedded
    ? "flex max-h-[calc(100vh-190px)] min-w-[300px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm"
    : "flex max-h-[calc(100vh-190px)] min-w-[300px] flex-col rounded-lg border border-slate-200 bg-slate-50 shadow-sm";
  const taskCardClass = embedded
    ? "rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
    : "rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md";
  const addColumnClass = embedded
    ? "min-w-[300px] self-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    : "min-w-[300px] self-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm";

  if (!isBrowser) return null;

  return (
    <div
      className={`${embedded ? "embedded-board-light min-h-full" : "min-h-screen"} text-slate-900`}
      style={{ backgroundColor: pageBackground }}
    >
      <header className={headerClass}>
        <div className={`${embedded ? "w-full" : "mx-auto max-w-7xl"} flex flex-col gap-4`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h1 className={`text-2xl font-bold ${embedded ? "text-slate-900" : "text-slate-950"}`}>{boardName}</h1>
              {boardDescription && (
                <p className={`mt-1 max-w-2xl text-sm ${embedded ? "text-slate-600" : "text-slate-600"}`}>{boardDescription}</p>
              )}
              <p className={`mt-1 text-sm ${embedded ? "text-slate-500" : "text-slate-500"}`}>
                {columns.length} columns / {totalTasks} tasks / {urgentTasks} urgent
              </p>
              <div className={`mt-2 inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-semibold ${
                embedded
                  ? "border border-slate-200 bg-slate-50 text-slate-600"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                Your role
                <span className={`rounded px-2 py-0.5 ${embedded ? "bg-white text-slate-900" : "bg-white text-slate-900"}`}>
                  {currentRole || "Loading"}
                </span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[260px_150px_180px_150px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks"
                className={inputClass}
              />
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className={inputClass}
              >
                <option value="ALL">All priorities</option>
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
                className={inputClass}
              >
                <option value="ALL">All assignees</option>
                <option value="UNASSIGNED">Unassigned</option>
                {boardMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.users.name}
                  </option>
                ))}
              </select>
              <select
                value={dueFilter}
                onChange={(event) => setDueFilter(event.target.value as DueFilter)}
                className={inputClass}
              >
                <option value="ALL">All due dates</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DUE_SOON">Due soon</option>
                <option value="NO_DUE">No due date</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPriorityFilter("ALL");
                  setAssigneeFilter("ALL");
                  setDueFilter("ALL");
                }}
                disabled={!isFiltering}
                className={`${inputClass} font-medium text-slate-600 border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 xl:col-span-2`}
              >
                Clear filters
              </button>
              {canManageBoard && (
                <button
                  type="button"
                  onClick={openSettings}
                  className="h-10 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 sm:col-span-1 xl:col-span-2"
                >
                  Board settings
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {error}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-1">
            <section className={panelClass}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className={`text-sm font-bold ${embedded ? "text-slate-900" : "text-slate-900"}`}>Team</h2>
                  <p className={`text-xs ${embedded ? "text-slate-500" : "text-slate-500"}`}>{boardMembers.length} members</p>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {boardMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className={`flex items-center gap-2 ${innerCardClass.replace("px-3 py-2", "px-2 py-1.5")}`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      {getInitials(member.users.name)}
                    </div>
                    <div className="min-w-0">
                      <p className={`max-w-32 truncate text-xs font-semibold ${embedded ? "text-slate-900" : "text-slate-900"}`}>
                        {member.users.name}
                      </p>
                      <p className={`text-[10px] font-medium ${embedded ? "text-slate-500" : "text-slate-500"}`}>
                        {member.project_role || member.role}
                      </p>
                    </div>
                    {canManageMembers && member.role !== "OWNER" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removingMemberId === member.user_id}
                        className="rounded px-1.5 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canManageMembers ? (
                <form onSubmit={handleAddMember} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px]">
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Member name"
                    className={`${inputClass} h-9 min-w-0 px-2`}
                  />
                  <select
                    value={memberProjectRole}
                    onChange={(event) => setMemberProjectRole(event.target.value)}
                    className={`${inputClass} h-9 px-2`}
                  >
                    <option value="">Select project role</option>
                    {projectRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={isAddingMember || !memberName.trim() || !memberProjectRole}
                    className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              ) : (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500">
                  Members can view the team, but only admins and owners can manage it.
                </div>
              )}
            </section>
          </div>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <main className={`${embedded ? "w-full" : "mx-auto max-w-7xl"} overflow-x-auto px-6 py-6`}>
          <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4">
                {visibleColumns.map((column, columnIndex) => (
                  <Draggable
                    key={column.id}
                    draggableId={column.id}
                    index={columnIndex}
                    isDragDisabled={!canManageColumns || isFiltering}
                  >
                    {(columnProvided, columnSnapshot) => (
                      <section
                        ref={columnProvided.innerRef}
                        {...columnProvided.draggableProps}
                        className={`${columnClass} ${
                          columnSnapshot.isDragging ? "shadow-lg ring-2 ring-slate-300" : ""
                        }`}
                      >
                        <div className={`border-b p-3 ${embedded ? "border-slate-200" : "border-slate-200"}`} {...columnProvided.dragHandleProps}>
                          {editingColumnId === column.id ? (
                            <form onSubmit={(event) => handleRenameColumn(event, column.id)} className="flex gap-2">
                              <input
                                value={editingColumnTitle}
                                onChange={(event) => setEditingColumnTitle(event.target.value)}
                                className={smallInputClass}
                                autoFocus
                              />
                              <button
                                type="submit"
                                disabled={savingColumnId === column.id || !editingColumnTitle.trim()}
                                className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <h2 className={`truncate text-sm font-bold uppercase tracking-wide ${embedded ? "text-slate-700" : "text-slate-700"}`}>
                                  {column.title}
                                </h2>
                                <p className={`mt-0.5 text-xs ${embedded ? "text-slate-500" : "text-slate-500"}`}>
                                  {column.tasks.length} shown /{" "}
                                  {columns.find((item) => item.id === column.id)?.tasks.length || 0} total
                                </p>
                              </div>
                              {canManageColumns && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingColumnId(column.id);
                                      setEditingColumnTitle(column.title);
                                    }}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteColumn(column.id)}
                                    disabled={deletingColumnId === column.id}
                                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Droppable droppableId={column.id} type="TASK">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="flex min-h-24 flex-1 flex-col gap-3 overflow-y-auto p-3"
                            >
                              {column.tasks.map((task, index) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={index}
                                  isDragDisabled={isFiltering}
                                >
                                  {(provided, snapshot) => (
                                    <article
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => {
                                        setTaskComments([]);
                                        setTaskAttachments([]);
                                      setSelectedTaskId(task.id);
                                      }}
                                      className={`${taskCardClass} ${
                                        snapshot.isDragging
                                          ? "shadow-lg ring-2 ring-slate-300"
                                          : ""
                                      }`}
                                    >
                                      <p className={`text-sm font-medium leading-5 ${embedded ? "text-slate-900" : "text-slate-900"}`}>{task.title}</p>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getPriorityClass(
                                            task.priority
                                          )}`}
                                        >
                                          {task.priority || "MEDIUM"}
                                        </span>
                                        {task.users && (
                                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[8px] font-bold text-white">
                                              {getInitials(task.users.name)}
                                            </span>
                                            {task.users.name}
                                          </span>
                                        )}
                                        {task.due_date && (
                                          <span className={`text-[11px] font-medium ${getDueClass(task.due_date)}`}>
                                            Due {toDateInputValue(task.due_date)}
                                          </span>
                                        )}
                                        {Boolean(task.sub_tasks?.length) && (
                                          <span className="text-[11px] font-medium text-slate-500">
                                            {(task.sub_tasks || []).filter((item) => item.is_completed).length}/
                                            {task.sub_tasks?.length}
                                          </span>
                                        )}
                                      </div>
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {column.tasks.length === 0 && (
                                <div className={`rounded-md border border-dashed px-3 py-5 text-center text-sm ${
                                  embedded
                                    ? "border-slate-200 bg-white text-slate-500"
                                    : "border-slate-300 bg-white text-slate-400"
                                }`}>
                                  {isFiltering ? "No matching tasks" : "No tasks yet"}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        <form onSubmit={(event) => handleCreateTask(event, column.id)} className={`border-t p-3 ${embedded ? "border-slate-200" : "border-slate-200"}`}>
                          <div className="flex gap-2">
                            <input
                              value={taskTitles[column.id] || ""}
                              onChange={(event) =>
                                setTaskTitles((currentTitles) => ({
                                  ...currentTitles,
                                  [column.id]: event.target.value,
                                }))
                              }
                              placeholder="Add task"
                              className={smallInputClass}
                            />
                            <button
                              type="submit"
                              disabled={savingTaskColumnId === column.id || !taskTitles[column.id]?.trim()}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </form>
                      </section>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {canManageColumns && (
                  <form
                    onSubmit={handleCreateColumn}
                    className={addColumnClass}
                  >
                    <input
                      value={columnTitle}
                      onChange={(event) => setColumnTitle(event.target.value)}
                      placeholder="New column name"
                      className={`mb-3 w-full ${inputClass}`}
                    />
                    <button
                      type="submit"
                      disabled={isSavingColumn || !columnTitle.trim()}
                      className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingColumn ? "Creating" : "Add column"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </Droppable>
        </main>
      </DragDropContext>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <form
            onSubmit={handleSaveSettings}
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Board settings
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Workspace details</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Board name</span>
              <input
                value={settingsTitle}
                onChange={(event) => setSettingsTitle(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                autoFocus
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={settingsDescription}
                onChange={(event) => setSettingsDescription(event.target.value)}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSettings || !settingsTitle.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingSettings ? "Saving" : "Save settings"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          key={selectedTask.id}
          task={selectedTask}
          members={boardMembers}
          comments={taskComments}
          attachments={taskAttachments}
          onClose={() => {
            setSelectedTaskId(null);
            setTaskComments([]);
            setTaskAttachments([]);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onDuplicate={handleDuplicateTask}
          onCreateSubTask={handleCreateSubTask}
          onToggleSubTask={handleToggleSubTask}
          onDeleteSubTask={handleDeleteSubTask}
          onCreateComment={handleCreateComment}
          onDeleteComment={handleDeleteComment}
          onCreateAttachment={handleCreateAttachment}
          onDeleteAttachment={handleDeleteAttachment}
        />
      )}
    </div>
  );
}

export default function BoardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <BoardWorkspace id={id} />;
}
