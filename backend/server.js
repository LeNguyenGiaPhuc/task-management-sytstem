const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ==========================================
// 1. CẤU HÌNH PRISMA 7 VỚI ADAPTER
// ==========================================
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Khởi tạo adapter truyền vào connection string từ file .env
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// Truyền adapter vào PrismaClient
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 2. MIDDLEWARES (Xử lý trung gian)
// ==========================================
// Cho phép Frontend (chạy ở port khác) gọi được API mà không bị lỗi CORS
app.use(cors()); 
// Giúp server đọc được dữ liệu JSON do Frontend gửi lên trong body
app.use(express.json()); 


// ==========================================
// 3. ROUTES (Các API Endpoints)
// ==========================================


// [POST] Tạo một Board mới
app.post('/api/boards', async (req, res) => {
  try {
    // Lấy dữ liệu từ Frontend gửi lên (body)
    const { title, description, owner_id } = req.body;

    // Validate (kiểm tra) dữ liệu đầu vào
    if (!title || !owner_id) {
      return res.status(400).json({ error: 'Thiếu title hoặc owner_id' });
    }

    // Gọi Prisma để lưu vào Database
    const newBoard = await prisma.boards.create({
      data: {
        title,
        description,
        owner_id
      }
    });

    // Trả về dữ liệu vừa tạo kèm HTTP status code 201 (Created)
    res.status(201).json(newBoard);
  } catch (error) {
    console.error('Lỗi POST /api/boards:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo board mới' });
  }
});

// API Test xem server có sống không
app.get('/', (req, res) => {
  res.send('🚀 Task Manager API is running smoothly!');
});

// [GET] Lấy danh sách tất cả Boards
app.get('/api/boards', async (req, res) => {
  try {
    const boards = await prisma.boards.findMany({
      orderBy: { created_at: 'desc' } // Sắp xếp board mới tạo lên đầu
    });
    res.status(200).json(boards);
  } catch (error) {
    console.error('Lỗi GET /api/boards:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu boards' });
  }
});


// ==========================================
// 4. KHỞI ĐỘNG SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🔥 Server đang chạy tại http://localhost:${PORT}`);
});