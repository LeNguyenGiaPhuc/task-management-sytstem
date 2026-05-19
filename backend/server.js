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

// ==========================================
// API CHO COLUMNS (CỘT TRẠNG THÁI)
// ==========================================

// [POST] Tạo một Cột mới trong Board
app.post('/api/columns', async (req, res) => {
  try {
    const { board_id, title } = req.body;

    if (!board_id || !title) {
      return res.status(400).json({ error: 'Thiếu board_id hoặc title' });
    }

    // 1. Tìm cột đang có vị trí (order) lớn nhất trong Board này
    const lastColumn = await prisma.columns.findFirst({
      where: { board_id: board_id },
      orderBy: { order: 'desc' }
    });

    // 2. Tính toán order mới (nếu chưa có cột nào thì mặc định là 1000)
    const newOrder = lastColumn ? lastColumn.order + 1000 : 1000;

    // 3. Tạo cột mới
    const newColumn = await prisma.columns.create({
      data: {
        board_id,
        title,
        order: newOrder
      }
    });

    res.status(201).json(newColumn);
  } catch (error) {
    console.error('Lỗi POST /api/columns:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo cột' });
  }
});


// ==========================================
// API CHO TASKS (THẺ CÔNG VIỆC)
// ==========================================

// [POST] Tạo một Task mới trong Cột
app.post('/api/tasks', async (req, res) => {
  try {
    const { column_id, title, description, priority, assignee_id } = req.body;

    if (!column_id || !title) {
      return res.status(400).json({ error: 'Thiếu column_id hoặc title' });
    }

    // 1. Tìm task đang có vị trí lớn nhất trong Cột này
    const lastTask = await prisma.tasks.findFirst({
      where: { column_id: column_id },
      orderBy: { order: 'desc' }
    });

    // 2. Tính toán order mới
    const newOrder = lastTask ? lastTask.order + 1000 : 1000;

    // 3. Tạo task mới
    const newTask = await prisma.tasks.create({
      data: {
        column_id,
        title,
        description,
        priority: priority || 'MEDIUM', // Mặc định là MEDIUM nếu không truyền
        assignee_id,
        order: newOrder
      }
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Lỗi POST /api/tasks:', error);
    res.status(500).json({ error: 'Lỗi server khi tạo task' });
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

// [GET] Lấy danh sách tất cả Columns (Nhớ sắp xếp theo thứ tự order)
app.get('/api/columns', async (req, res) => {
  try {
    const columns = await prisma.columns.findMany({
      orderBy: { order: 'asc' } // Sắp xếp từ nhỏ đến lớn (1000, 2000, 3000...)
    });
    res.status(200).json(columns);
  } catch (error) {
    console.error('Lỗi GET /api/columns:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu cột' });
  }
});

// [GET] Lấy danh sách tất cả Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.tasks.findMany({
      orderBy: { order: 'asc' }
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Lỗi GET /api/tasks:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu task' });
  }
});

// [GET] Lấy chi tiết một Board (kèm theo Cột và Task bên trong)
app.get('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID từ trên thanh địa chỉ url

    const board = await prisma.boards.findUnique({
      where: { id: id },
      // Tuyệt chiêu Nested Read của Prisma: Lấy luôn bảng con và bảng cháu
      include: {
        columns: {
          orderBy: { order: 'asc' }, // Sắp xếp cột từ trái qua phải
          include: {
            tasks: {
              orderBy: { order: 'asc' } // Sắp xếp task từ trên xuống dưới
            }
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({ error: 'Không tìm thấy Board' });
    }

    res.status(200).json(board);
  } catch (error) {
    console.error('Lỗi GET /api/boards/:id:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết board' });
  }
});


// ==========================================
// 4. KHỞI ĐỘNG SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🔥 Server đang chạy tại http://localhost:${PORT}`);
});

// [PUT] Cập nhật vị trí (order) và cột của Task khi kéo thả
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, order } = req.body;

    const updatedTask = await prisma.tasks.update({
      where: { id: id },
      data: {
        column_id: column_id,
        order: order
      }
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Lỗi PUT /api/tasks/:id:', error);
    res.status(500).json({ error: 'Lỗi server khi cập nhật vị trí task' });
  }
});