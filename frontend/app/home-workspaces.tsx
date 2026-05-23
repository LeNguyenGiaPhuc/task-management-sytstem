"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearAuthToken, setAuthToken, type AuthUser } from "./api";
import { BoardWorkspace } from "./boards/[id]/page";
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
type AuthMode = "login" | "register";
type SidebarItem = "Spaces";

const sidebarItems: SidebarItem[] = ["Spaces"];

const demoAccounts = [
  {
    role: "OWNER",
    email: "demo@task-manager.local",
    note: "Full board control",
  },
  {
    role: "ADMIN",
    email: "designer@task-manager.local",
    note: "Manage board and columns",
  },
  {
    role: "MEMBER",
    email: "engineer@task-manager.local",
    note: "Work on tasks",
  },
];

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

export default function HomeWorkspaces() {
  const router = useRouter();
  const [boards, setBoards] = useState<HomeBoard[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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
  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItem>("Spaces");
  const [isSpacesOpen, setIsSpacesOpen] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

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
  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) || null,
    [boards, selectedBoardId]
  );

  const loadBoards = useCallback(async () => {
    const response = await apiFetch("/api/boards");

    if (!response.ok) {
      if (response.status === 401) {
        clearAuthToken();
        setCurrentUser(null);
        return;
      }
      throw new Error("Load boards failed");
    }

    const boardData = (await response.json()) as HomeBoard[];
    setBoards(boardData);
  }, []);

  const loadSession = useCallback(async () => {
    const response = await apiFetch("/api/auth/me");

    if (!response.ok) {
      clearAuthToken();
      setCurrentUser(null);
      setBoards([]);
      setIsAuthChecked(true);
      return;
    }

    const data = (await response.json()) as { user: AuthUser };
    setCurrentUser(data.user);
    await loadBoards();
    setIsAuthChecked(true);
  }, [loadBoards]);

  useEffect(() => {
    // Restore an existing local JWT session on first client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSession();
  }, [loadSession]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthenticating(true);
    setError("");

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          ...(authMode === "register" ? { name: authName.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Authentication failed");
      }

      const data = (await response.json()) as { token: string; user: AuthUser };
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setAuthPassword("");
      await loadBoards();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not authenticate.");
    } finally {
      setIsAuthenticating(false);
      setIsAuthChecked(true);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setBoards([]);
    router.push("/");
  };

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
      const response = await apiFetch(`/api/boards/${editingBoard.id}`, {
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
      const response = await apiFetch(`/api/boards/${boardId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Duplicate board failed");

      const duplicatedBoard = (await response.json()) as HomeBoard;
      setBoards((currentBoards) => [duplicatedBoard, ...currentBoards]);
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
      const response = await apiFetch(`/api/boards/${deletingBoard.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Delete board failed");

      setBoards((currentBoards) =>
        currentBoards.filter((board) => board.id !== deletingBoard.id)
      );
      setDeletingBoard(null);
    } catch {
      setError("Khong xoa duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Loading workspace...
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
        <form
          onSubmit={handleAuthSubmit}
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Task Manager
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            {authMode === "login" ? "Login to your workspace" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Use a real account to manage boards with OWNER, ADMIN, and MEMBER permissions.
          </p>

          {authMode === "register" && (
            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
              <input
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </label>
          )}

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Demo accounts</p>
              <p className="text-xs font-medium text-slate-500">Password: password123</p>
            </div>
            <div className="grid gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthEmail(account.email);
                    setAuthPassword("password123");
                    setError("");
                  }}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900">{account.role}</span>
                    <span className="block truncate text-xs text-slate-500">{account.email}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500">
                    {account.note}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating || !authEmail.trim() || !authPassword || (authMode === "register" && !authName.trim())}
            className="mt-5 h-10 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAuthenticating ? "Please wait" : authMode === "login" ? "Login" : "Register"}
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setError("");
            }}
            className="mt-3 w-full rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {authMode === "login" ? "Need an account? Register" : "Already have an account? Login"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 md:block">
          <nav className="grid gap-1 text-sm">
            {sidebarItems.map((item) => {
              const isActive = activeSidebarItem === item;

              return (
                <div key={item}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSidebarItem(item);
                      if (item === "Spaces") {
                        setIsSpacesOpen(true);
                        setSelectedBoardId(null);
                        return;
                      }
                      setSelectedBoardId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-medium transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{item}</span>
                    {item === "Spaces" && <span className="text-xs text-blue-600">{boards.length}</span>}
                  </button>

                  {item === "Spaces" && activeSidebarItem === item && isSpacesOpen && (
                    <div className="mt-1 grid gap-1 pl-3">
                      {boards.length > 0 ? (
                        boards.map((board, index) => (
                          <button
                            key={board.id}
                            type="button"
                            onClick={() => {
                              setActiveSidebarItem("Spaces");
                              setIsSpacesOpen(true);
                              setSelectedBoardId(board.id);
                            }}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                              selectedBoardId === board.id
                                ? "bg-blue-50 text-blue-800"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">
                              P{index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{board.title}</span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-md px-3 py-2 text-xs text-slate-500">
                          No workspaces yet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent
            </p>
            <div className="mt-2 grid gap-1">
              {boards.slice(0, 5).map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => {
                    setActiveSidebarItem("Spaces");
                    setIsSpacesOpen(true);
                    setSelectedBoardId(board.id);
                  }}
                  className="truncate rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {board.title}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 bg-slate-100">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search boards"
                    className="h-9 w-full max-w-2xl rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CreateBoardButton
                  onCreated={async (board) => {
                    await loadBoards();
                    setActiveSidebarItem("Spaces");
                    setIsSpacesOpen(true);
                    setSelectedBoardId(board.id);
                  }}
                />
                <div className="hidden h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 sm:flex">
                  {currentUser.email}
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="px-5 py-5">
            {selectedBoard ? (
              <div className="-mx-5 -my-5 min-h-[calc(100vh-65px)] bg-slate-100">
                <BoardWorkspace
                  id={selectedBoard.id}
                  embedded
                />
              </div>
            ) : (
              <>
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-500">Spaces</p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                      TM
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Task Management Workspace</h1>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {boards.length} boards / {totalColumns} columns / {totalTasks} tasks
                  </p>
                </div>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="recent">Newest first</option>
                  <option value="updated">Recently updated</option>
                  <option value="az">A to Z</option>
                  <option value="za">Z to A</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                {error}
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                Showing {filteredBoards.length} of {boards.length}
              </div>
              <button
                type="button"
                onClick={() => setQuery("")}
                disabled={!query.trim()}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear search
              </button>
            </div>

            {filteredBoards.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredBoards.map((board) => (
                  <article
                    key={board.id}
                    className="rounded-md border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSidebarItem("Spaces");
                        setIsSpacesOpen(true);
                        setSelectedBoardId(board.id);
                      }}
                      className="block w-full p-4 text-left"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold text-slate-900" title={board.title}>
                            {board.title}
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">
                            Updated {formatDate(board.updated_at)}
                          </p>
                        </div>
                        <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>

                      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
                        {board.description || "No description"}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-xs text-slate-500">Columns</p>
                          <p className="mt-1 font-semibold text-slate-900">{board.columns?.length || 0}</p>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-xs text-slate-500">Tasks</p>
                          <p className="mt-1 font-semibold text-slate-900">{getTaskCount(board)}</p>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                      <span className="text-xs text-slate-500">
                        Created {formatDate(board.created_at)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(board.id)}
                          disabled={duplicatingBoardId === board.id}
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {duplicatingBoardId === board.id ? "Copying" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(board)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingBoard(board);
                            setError("");
                          }}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                {boards.length === 0
                  ? "No boards yet. Create the first workspace to start."
                  : "No boards match your search."}
              </div>
            )}
              </>
            )}
          </div>
        </section>
      </div>

      {editingBoard && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/30 px-4 py-12">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl"
          >
            <h2 className="mb-4 text-xl font-bold text-slate-900">Edit board</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Board name
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingBoard && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/30 px-4 py-12">
          <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">Delete board?</h2>
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
