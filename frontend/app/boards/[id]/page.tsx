"use client";

import { use, useEffect, useState, useSyncExternalStore } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

type Task = {
  id: string;
  title: string;
  priority?: string | null;
  order: number;
};

type Column = {
  id: string;
  title: string;
  tasks: Task[];
};

type BoardData = {
  title: string;
  columns?: Column[];
};

export default function BoardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [boardName, setBoardName] = useState("Đang tải...");
  const [columns, setColumns] = useState<Column[]>([]);
  const isBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/boards/${id}`);
        const boardData = (await res.json()) as BoardData;
        setBoardName(boardData.title);
        setColumns(boardData.columns || []);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
      }
    };
    fetchBoardData();
  }, [id]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColIndex = columns.findIndex((column) => column.id === source.droppableId);
    const destColIndex = columns.findIndex((column) => column.id === destination.droppableId);

    if (sourceColIndex === -1 || destColIndex === -1) return;

    const sourceCol = columns[sourceColIndex];
    const destCol = columns[destColIndex];
    const newColumns = [...columns];

    let destTasks: Task[] = Array.from(destCol.tasks);
    
    // 1. Cập nhật giao diện tạm thời (Optimistic UI)
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

    // 2. Tính toán order mới (dựa trên vị trí lân cận)
    let newOrder = 1000;
    if (destTasks.length > 1) {
      if (destination.index === 0) {
        newOrder = destTasks[1].order / 2;
      } else if (destination.index === destTasks.length - 1) {
        newOrder = destTasks[destTasks.length - 2].order + 1000;
      } else {
        newOrder = (destTasks[destination.index - 1].order + destTasks[destination.index + 1].order) / 2;
      }
    }

    // 3. Gửi lệnh lưu vào Database
    try {
      await fetch(`http://127.0.0.1:5000/api/tasks/${draggableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: destination.droppableId, order: newOrder })
      });
    } catch (error) {
      console.error("Lỗi lưu database:", error);
    }
  };

  if (!isBrowser) return null;

  return (
    <div className="min-h-screen bg-blue-600 p-4 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">{boardName}</h1>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-120px)] items-start">
          {columns.map((column) => (
            <div key={column.id} className="bg-gray-100 min-w-[280px] rounded-xl p-3 flex flex-col gap-3 shadow-sm">
              <h2 className="font-bold text-gray-700 px-1">{column.title}</h2>
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[50px] flex flex-col gap-3">
                    {column.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-grab ${
                              snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-2' : ''
                            }`}
                          >
                            <p className="text-sm text-gray-800 font-medium">{task.title}</p>
                            {task.priority && (
                              <span className="inline-block mt-2 px-2 py-1 text-[10px] font-bold rounded-sm bg-red-100 text-red-600">
                                {task.priority}
                              </span>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
