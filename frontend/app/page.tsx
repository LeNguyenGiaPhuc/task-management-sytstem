import React from 'react';
import Link from 'next/link'; // <-- Import thẻ Link của Next.js

// Báo cho Next.js biết trang này là dữ liệu động, không được cache 
// (Để khi bạn tạo board mới bên Thunder Client, F5 lại nó sẽ hiện ngay)
export const dynamic = 'force-dynamic';

type Board = {
  id: string | number;
  title: string;
  description?: string | null;
};

export default async function Home() {
  // Gọi API thẳng xuống Backend Express đang chạy ở port 5000
  const res = await fetch('http://127.0.0.1:5000/api/boards');
  const boards = (await res.json()) as Board[];

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">🚀 Workspaces</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition">
          + Tạo Board mới
        </button>
      </div>
      
      {/* Lưới hiển thị danh sách các Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {boards.length > 0 ? (
          boards.map((board) => (
            // Bọc Link ra ngoài và đưa thuộc tính key lên đây
            <Link key={board.id} href={`/boards/${board.id}`}>
              <div 
                className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition flex flex-col h-32 justify-between"
              >
                <h2 className="text-lg font-semibold truncate" title={board.title}>
                  {board.title}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-2">
                  {board.description || 'Không có mô tả'}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-gray-500 italic">Chưa có dự án nào. Hãy tạo cái đầu tiên!</p>
        )}
      </div>
    </main>
  );
}