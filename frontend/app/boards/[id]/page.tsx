"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type PriorityFilter = "ALL" | Priority;

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
  due_date?: string | null;
  order: number;
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
  columns?: Column[];
};

type CreatedColumn = Omit<Column, "tasks">;

type TaskUpdate = {
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
};

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

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

function getColumnTaskCount(columns: Column[]) {
  return columns.reduce((total, column) => total + column.tasks.length, 0);
}

function getPriorityClass(priority?: Priority | null) {
  if (priority === "URGENT") return "bg-red-50 text-red-700 ring-red-200";
  if (priority === "HIGH") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (priority === "LOW") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function TaskDetailModal({
  task,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onCreateSubTask,
  onToggleSubTask,
  onDeleteSubTask,
}: {
  task: Task;
  onClose: () => void;
  onSave: (values: TaskUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => Promise<void>;
  onCreateSubTask: (title: string) => Promise<void>;
  onToggleSubTask: (subTask: SubTask) => Promise<void>;
  onDeleteSubTask: (subTaskId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<Priority>(task.priority || "MEDIUM");
  const [dueDate, setDueDate] = useState(toDateInputValue(task.due_date));
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isAddingSubTask, setIsAddingSubTask] = useState(false);

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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
    </div>
  );
}

export default function BoardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [boardName, setBoardName] = useState("Loading...");
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnTitle, setColumnTitle] = useState("");
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSavingColumn, setIsSavingColumn] = useState(false);
  const [savingColumnId, setSavingColumnId] = useState<string | null>(null);
  const [savingTaskColumnId, setSavingTaskColumnId] = useState<string | null>(null);
  const isBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const selectedTask =
    columns.flatMap((column) => column.tasks).find((task) => task.id === selectedTaskId) || null;

  const isFiltering = query.trim().length > 0 || priorityFilter !== "ALL";
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
        return matchesQuery && matchesPriority;
      }),
    }));
  }, [columns, priorityFilter, query]);

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

  useEffect(() => {
    let isActive = true;

    const fetchBoardData = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/boards/${id}`);
        if (!res.ok) throw new Error("Load board failed");

        const boardData = (await res.json()) as BoardData;

        if (isActive) {
          setBoardName(boardData.title);
          setColumns(
            (boardData.columns || []).map((column) => ({
              ...column,
              tasks: column.tasks.map(normalizeTask),
            }))
          );
          setError("");
        }
      } catch {
        if (isActive) setError("Could not load board. Check backend and try again.");
      }
    };

    fetchBoardData();

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleCreateColumn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = columnTitle.trim();
    if (!title) return;

    setError("");
    setIsSavingColumn(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: id, title }),
      });

      if (!res.ok) throw new Error("Create column failed");

      const column = (await res.json()) as CreatedColumn;
      setColumns((currentColumns) => [...currentColumns, { ...column, tasks: [] }]);
      setColumnTitle("");
    } catch {
      setError("Could not create column. Check backend and try again.");
    } finally {
      setIsSavingColumn(false);
    }
  };

  const handleRenameColumn = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();
    const title = editingColumnTitle.trim();
    if (!title) return;

    setSavingColumnId(columnId);
    setError("");

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/columns/${columnId}`, {
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
    } catch {
      setError("Could not rename column. Try again.");
    } finally {
      setSavingColumnId(null);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    setDeletingColumnId(columnId);
    setError("");

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/columns/${columnId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete column failed");

      setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId));
    } catch {
      setError("Could not delete column. Try again.");
    } finally {
      setDeletingColumnId(null);
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>, columnId: string) => {
    event.preventDefault();

    const title = taskTitles[columnId]?.trim();
    if (!title) return;

    setError("");
    setSavingTaskColumnId(columnId);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/tasks", {
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
    } catch {
      setError("Could not create task. Check backend and try again.");
    } finally {
      setSavingTaskColumnId(null);
    }
  };

  const handleSaveTask = async (values: TaskUpdate) => {
    if (!selectedTask) return;

    const res = await fetch(`http://127.0.0.1:5000/api/tasks/${selectedTask.id}`, {
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
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    const res = await fetch(`http://127.0.0.1:5000/api/tasks/${selectedTask.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Could not delete task. Try again.");
      return;
    }

    removeTaskFromColumns(selectedTask.id);
    setSelectedTaskId(null);
    setError("");
  };

  const handleDuplicateTask = async () => {
    if (!selectedTask) return;

    const column = columns.find((item) => item.tasks.some((task) => task.id === selectedTask.id));
    if (!column) return;

    const res = await fetch("http://127.0.0.1:5000/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        column_id: column.id,
        title: `${selectedTask.title} Copy`,
        description: selectedTask.description || null,
        priority: selectedTask.priority || "MEDIUM",
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
  };

  const handleCreateSubTask = async (title: string) => {
    if (!selectedTask) return;

    const res = await fetch("http://127.0.0.1:5000/api/subtasks", {
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
  };

  const handleToggleSubTask = async (subTask: SubTask) => {
    if (!selectedTask) return;

    const res = await fetch(`http://127.0.0.1:5000/api/subtasks/${subTask.id}`, {
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
  };

  const handleDeleteSubTask = async (subTaskId: string) => {
    if (!selectedTask) return;

    const res = await fetch(`http://127.0.0.1:5000/api/subtasks/${subTaskId}`, {
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
  };

  const onDragEnd = async (result: DropResult) => {
    if (isFiltering) {
      setError("Clear search/filter before reordering tasks.");
      return;
    }

    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
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
      const res = await fetch(`http://127.0.0.1:5000/api/tasks/${draggableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_id: destination.droppableId,
          order: newOrder,
        }),
      });

      if (!res.ok) throw new Error("Move task failed");
    } catch {
      setError("Could not save task position. Try again.");
    }
  };

  if (!isBrowser) return null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Workspaces
              </Link>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{boardName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {columns.length} columns / {totalTasks} tasks / {urgentTasks} urgent
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[260px_150px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks"
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="ALL">All priorities</option>
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {error}
            </div>
          )}
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <main className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-6 py-6">
          {visibleColumns.map((column) => (
            <section
              key={column.id}
              className="flex max-h-[calc(100vh-190px)] min-w-[300px] flex-col rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
            >
              <div className="border-b border-slate-200 p-3">
                {editingColumnId === column.id ? (
                  <form onSubmit={(event) => handleRenameColumn(event, column.id)} className="flex gap-2">
                    <input
                      value={editingColumnTitle}
                      onChange={(event) => setEditingColumnTitle(event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={savingColumnId === column.id || !editingColumnTitle.trim()}
                      className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold uppercase tracking-wide text-slate-700">
                        {column.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {column.tasks.length} shown /{" "}
                        {columns.find((item) => item.id === column.id)?.tasks.length || 0} total
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingColumnId(column.id);
                          setEditingColumnTitle(column.title);
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
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
                  </div>
                )}
              </div>

              <Droppable droppableId={column.id}>
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
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`rounded-md border border-slate-200 bg-white p-3 shadow-sm transition ${
                              snapshot.isDragging
                                ? "shadow-lg ring-2 ring-slate-300"
                                : "hover:border-slate-300 hover:shadow-md"
                            }`}
                          >
                            <p className="text-sm font-medium leading-5 text-slate-900">{task.title}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ring-1 ${getPriorityClass(
                                  task.priority
                                )}`}
                              >
                                {task.priority || "MEDIUM"}
                              </span>
                              {task.due_date && (
                                <span className="text-[11px] font-medium text-slate-500">
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
                      <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-sm text-slate-400">
                        {isFiltering ? "No matching tasks" : "No tasks yet"}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <form onSubmit={(event) => handleCreateTask(event, column.id)} className="border-t border-slate-200 p-3">
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
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={savingTaskColumnId === column.id || !taskTitles[column.id]?.trim()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            </section>
          ))}

          <form
            onSubmit={handleCreateColumn}
            className="min-w-[300px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <input
              value={columnTitle}
              onChange={(event) => setColumnTitle(event.target.value)}
              placeholder="New column name"
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              disabled={isSavingColumn || !columnTitle.trim()}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingColumn ? "Creating" : "Add column"}
            </button>
          </form>
        </main>
      </DragDropContext>

      {selectedTask && (
        <TaskDetailModal
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onDuplicate={handleDuplicateTask}
          onCreateSubTask={handleCreateSubTask}
          onToggleSubTask={handleToggleSubTask}
          onDeleteSubTask={handleDeleteSubTask}
        />
      )}
    </div>
  );
}
