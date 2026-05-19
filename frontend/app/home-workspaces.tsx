"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CreateBoardButton from "./create-board-button";

type BoardColumnSummary = {
  id: string;
  tasks?: { id: string }[];
};

export type HomeBoard = {
  id: string;
  title: string;
  description?: string | null;
  background?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  columns?: BoardColumnSummary[];
};

type SortMode = "recent" | "updated" | "az" | "za";

function getTaskCount(board: HomeBoard) {
  return (board.columns || []).reduce(
    (total, column) => total + (column.tasks?.length || 0),
    0
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function HomeWorkspaces({ initialBoards }: { initialBoards: HomeBoard[] }) {
  const router = useRouter();
  const [boards, setBoards] = useState(initialBoards);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [editingBoard, setEditingBoard] = useState<HomeBoard | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<HomeBoard | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicatingBoardId, setDuplicatingBoardId] = useState<string | null>(null);

  const filteredBoards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = boards.filter((board) => {
      if (!normalizedQuery) return true;
      return `${board.title} ${board.description || ""}`
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return result.sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      if (sortMode === "za") return b.title.localeCompare(a.title);
      if (sortMode === "updated") {
        return (
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
        );
      }
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [boards, query, sortMode]);

  const totalTasks = boards.reduce((total, board) => total + getTaskCount(board), 0);
  const totalColumns = boards.reduce(
    (total, board) => total + (board.columns?.length || 0),
    0
  );

  const openEdit = (board: HomeBoard) => {
    setEditingBoard(board);
    setTitle(board.title);
    setDescription(board.description || "");
    setError("");
  };

  const closeEdit = () => {
    setEditingBoard(null);
    setTitle("");
    setDescription("");
    setError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBoard || !title.trim()) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/boards/${editingBoard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          background: editingBoard.background || null,
        }),
      });

      if (!response.ok) throw new Error("Update board failed");

      const updatedBoard = (await response.json()) as HomeBoard;
      setBoards((currentBoards) =>
        currentBoards.map((board) =>
          board.id === updatedBoard.id ? updatedBoard : board
        )
      );
      router.refresh();
      closeEdit();
    } catch {
      setError("Khong luu duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (boardId: string) => {
    setDuplicatingBoardId(boardId);
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/boards/${boardId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Duplicate board failed");

      const duplicatedBoard = (await response.json()) as HomeBoard;
      setBoards((currentBoards) => [duplicatedBoard, ...currentBoards]);
      router.refresh();
    } catch {
      setError("Khong nhan ban duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setDuplicatingBoardId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingBoard) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/boards/${deletingBoard.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete board failed");

      setBoards((currentBoards) =>
        currentBoards.filter((board) => board.id !== deletingBoard.id)
      );
      setDeletingBoard(null);
      router.refresh();
    } catch {
      setError("Khong xoa duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-5 border-b border-slate-200 pb-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project management
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">Workspaces</h1>
              <p className="mt-2 text-sm text-slate-500">
                {boards.length} boards / {totalColumns} columns / {totalTasks} tasks
              </p>
            </div>
            <CreateBoardButton />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by board name or description"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="recent">Newest first</option>
              <option value="updated">Recently updated</option>
              <option value="az">A to Z</option>
              <option value="za">Z to A</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {filteredBoards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBoards.map((board) => (
              <article
                key={board.id}
                className="flex min-h-52 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <Link href={`/boards/${board.id}`} className="block">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-slate-950" title={board.title}>
                        {board.title}
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Updated {formatDate(board.updated_at)}
                      </p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      Active
                    </span>
                  </div>

                  <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                    {board.description || "No description"}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500">Columns</p>
                      <p className="mt-1 font-semibold text-slate-900">{board.columns?.length || 0}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="text-xs text-slate-500">Tasks</p>
                      <p className="mt-1 font-semibold text-slate-900">{getTaskCount(board)}</p>
                    </div>
                  </div>
                </Link>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">
                    Created {formatDate(board.created_at)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(board.id)}
                      disabled={duplicatingBoardId === board.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {duplicatingBoardId === board.id ? "Copying" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(board)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingBoard(board);
                        setError("");
                      }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            {boards.length === 0
              ? "No boards yet. Create the first workspace to start."
              : "No boards match your search."}
          </div>
        )}
      </div>

      {editingBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <h2 className="mb-4 text-xl font-bold text-slate-950">Edit board</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Board name
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                autoFocus
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-xl font-bold text-slate-950">Delete board?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {deletingBoard.title} and all of its columns and tasks will be deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBoard(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting" : "Delete board"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
