"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CreateBoardResponse = {
  id: string;
};

export default function CreateBoardButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Create board failed");
      }

      const board = (await response.json()) as CreateBoardResponse;
      setTitle("");
      setDescription("");
      setIsOpen(false);
      router.refresh();
      router.push(`/boards/${board.id}`);
    } catch {
      setError("Khong tao duoc board. Kiem tra backend roi thu lai.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        + New board
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-950">Create board</h2>
            </div>

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

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Creating" : "Create board"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
