const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 5000;
const DEMO_USER_EMAIL = 'demo@task-manager.local';

app.use(cors());
app.use(express.json());

async function getDemoUserId() {
  const user = await prisma.users.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: 'Demo User'
    }
  });

  return user.id;
}

function cleanText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

app.get('/', (req, res) => {
  res.send('Task Manager API is running smoothly!');
});

app.get('/api/boards', async (req, res) => {
  try {
    const boards = await prisma.boards.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        columns: {
          select: {
            id: true,
            tasks: {
              select: { id: true }
            }
          }
        }
      }
    });
    res.status(200).json(boards);
  } catch (error) {
    console.error('GET /api/boards failed:', error);
    res.status(500).json({ error: 'Server error while loading boards' });
  }
});

app.post('/api/boards', async (req, res) => {
  try {
    const { title, description, owner_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const ownerId = owner_id || await getDemoUserId();
    const newBoard = await prisma.$transaction(async (tx) => {
      const board = await tx.boards.create({
        data: {
          title: title.trim(),
          description: cleanText(description),
          owner_id: ownerId
        }
      });

      await tx.board_members.create({
        data: {
          board_id: board.id,
          user_id: ownerId,
          role: 'OWNER'
        }
      });

      return board;
    });

    res.status(201).json(newBoard);
  } catch (error) {
    console.error('POST /api/boards failed:', error);
    res.status(500).json({ error: 'Server error while creating board' });
  }
});

app.put('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, background } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const updatedBoard = await prisma.boards.update({
      where: { id },
      data: {
        title: title.trim(),
        description: cleanText(description),
        background: cleanText(background)
      },
      include: {
        columns: {
          select: {
            id: true,
            tasks: {
              select: { id: true }
            }
          }
        }
      }
    });

    res.status(200).json(updatedBoard);
  } catch (error) {
    console.error('PUT /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating board' });
  }
});

app.delete('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.boards.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting board' });
  }
});

app.post('/api/boards/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = await getDemoUserId();
    const sourceBoard = await prisma.boards.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                sub_tasks: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!sourceBoard) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const duplicatedBoard = await prisma.$transaction(async (tx) => {
      const board = await tx.boards.create({
        data: {
          title: `${sourceBoard.title} Copy`,
          description: sourceBoard.description,
          background: sourceBoard.background,
          owner_id: ownerId
        }
      });

      await tx.board_members.create({
        data: {
          board_id: board.id,
          user_id: ownerId,
          role: 'OWNER'
        }
      });

      for (const column of sourceBoard.columns) {
        const newColumn = await tx.columns.create({
          data: {
            board_id: board.id,
            title: column.title,
            order: column.order
          }
        });

        for (const task of column.tasks) {
          const newTask = await tx.tasks.create({
            data: {
              column_id: newColumn.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              assignee_id: null,
              due_date: task.due_date,
              order: task.order
            }
          });

          for (const subTask of task.sub_tasks) {
            await tx.sub_tasks.create({
              data: {
                task_id: newTask.id,
                title: subTask.title,
                is_completed: subTask.is_completed,
                order: subTask.order
              }
            });
          }
        }
      }

      return board;
    });

    const boardWithSummary = await prisma.boards.findUnique({
      where: { id: duplicatedBoard.id },
      include: {
        columns: {
          select: {
            id: true,
            tasks: {
              select: { id: true }
            }
          }
        }
      }
    });

    res.status(201).json(boardWithSummary);
  } catch (error) {
    console.error('POST /api/boards/:id/duplicate failed:', error);
    res.status(500).json({ error: 'Server error while duplicating board' });
  }
});

app.get('/api/boards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const board = await prisma.boards.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                sub_tasks: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.status(200).json(board);
  } catch (error) {
    console.error('GET /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while loading board' });
  }
});

app.post('/api/columns', async (req, res) => {
  try {
    const { board_id, title } = req.body;

    if (!board_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing board_id or title' });
    }

    const lastColumn = await prisma.columns.findFirst({
      where: { board_id },
      orderBy: { order: 'desc' }
    });
    const newOrder = lastColumn ? lastColumn.order + 1000 : 1000;

    const newColumn = await prisma.columns.create({
      data: {
        board_id,
        title: title.trim(),
        order: newOrder
      }
    });

    res.status(201).json(newColumn);
  } catch (error) {
    console.error('POST /api/columns failed:', error);
    res.status(500).json({ error: 'Server error while creating column' });
  }
});

app.put('/api/columns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const updatedColumn = await prisma.columns.update({
      where: { id },
      data: { title: title.trim() }
    });

    res.status(200).json(updatedColumn);
  } catch (error) {
    console.error('PUT /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating column' });
  }
});

app.delete('/api/columns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.columns.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting column' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.tasks.findMany({
      orderBy: { order: 'asc' },
      include: {
        sub_tasks: {
          orderBy: { order: 'asc' }
        }
      }
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error('GET /api/tasks failed:', error);
    res.status(500).json({ error: 'Server error while loading tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { column_id, title, description, priority, assignee_id, due_date } = req.body;

    if (!column_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing column_id or title' });
    }

    const lastTask = await prisma.tasks.findFirst({
      where: { column_id },
      orderBy: { order: 'desc' }
    });
    const newOrder = lastTask ? lastTask.order + 1000 : 1000;

    const newTask = await prisma.tasks.create({
      data: {
        column_id,
        title: title.trim(),
        description: cleanText(description),
        priority: priority || 'MEDIUM',
        assignee_id: assignee_id || null,
        due_date: due_date ? new Date(due_date) : null,
        order: newOrder
      },
      include: {
        sub_tasks: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('POST /api/tasks failed:', error);
    res.status(500).json({ error: 'Server error while creating task' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, title, description, priority, assignee_id, due_date, order } = req.body;
    const data = {};

    if (column_id !== undefined) data.column_id = column_id;
    if (order !== undefined) data.order = Number(order);
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = cleanText(description);
    if (priority !== undefined) data.priority = priority;
    if (assignee_id !== undefined) data.assignee_id = assignee_id || null;
    if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null;

    const updatedTask = await prisma.tasks.update({
      where: { id },
      data,
      include: {
        sub_tasks: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('PUT /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating task' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.tasks.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting task' });
  }
});

app.post('/api/subtasks', async (req, res) => {
  try {
    const { task_id, title } = req.body;

    if (!task_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing task_id or title' });
    }

    const lastSubTask = await prisma.sub_tasks.findFirst({
      where: { task_id },
      orderBy: { order: 'desc' }
    });
    const newOrder = lastSubTask ? lastSubTask.order + 1000 : 1000;

    const newSubTask = await prisma.sub_tasks.create({
      data: {
        task_id,
        title: title.trim(),
        order: newOrder
      }
    });

    res.status(201).json(newSubTask);
  } catch (error) {
    console.error('POST /api/subtasks failed:', error);
    res.status(500).json({ error: 'Server error while creating subtask' });
  }
});

app.put('/api/subtasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_completed, order } = req.body;
    const data = {};

    if (title !== undefined) data.title = title.trim();
    if (is_completed !== undefined) data.is_completed = Boolean(is_completed);
    if (order !== undefined) data.order = Number(order);

    const updatedSubTask = await prisma.sub_tasks.update({
      where: { id },
      data
    });

    res.status(200).json(updatedSubTask);
  } catch (error) {
    console.error('PUT /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating subtask' });
  }
});

app.delete('/api/subtasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sub_tasks.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting subtask' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
