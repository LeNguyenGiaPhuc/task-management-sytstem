const express = require('express');
const prisma = require('../lib/prisma');
const { getDemoUserId } = require('../services/users.service');
const { cleanText } = require('../utils/text');

const router = express.Router();

const boardSummaryInclude = {
  columns: {
    select: {
      id: true,
      tasks: {
        select: { id: true },
      },
    },
  },
};

const boardDetailInclude = {
  columns: {
    orderBy: { order: 'asc' },
    include: {
      tasks: {
        orderBy: { order: 'asc' },
        include: {
          sub_tasks: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  },
};

router.get('/', async (req, res) => {
  try {
    const boards = await prisma.boards.findMany({
      orderBy: { created_at: 'desc' },
      include: boardSummaryInclude,
    });

    res.status(200).json(boards);
  } catch (error) {
    console.error('GET /api/boards failed:', error);
    res.status(500).json({ error: 'Server error while loading boards' });
  }
});

router.post('/', async (req, res) => {
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
          owner_id: ownerId,
        },
      });

      await tx.board_members.create({
        data: {
          board_id: board.id,
          user_id: ownerId,
          role: 'OWNER',
        },
      });

      return board;
    });

    res.status(201).json(newBoard);
  } catch (error) {
    console.error('POST /api/boards failed:', error);
    res.status(500).json({ error: 'Server error while creating board' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = await getDemoUserId();
    const sourceBoard = await prisma.boards.findUnique({
      where: { id },
      include: boardDetailInclude,
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
          owner_id: ownerId,
        },
      });

      await tx.board_members.create({
        data: {
          board_id: board.id,
          user_id: ownerId,
          role: 'OWNER',
        },
      });

      for (const column of sourceBoard.columns) {
        const newColumn = await tx.columns.create({
          data: {
            board_id: board.id,
            title: column.title,
            order: column.order,
          },
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
              order: task.order,
            },
          });

          for (const subTask of task.sub_tasks) {
            await tx.sub_tasks.create({
              data: {
                task_id: newTask.id,
                title: subTask.title,
                is_completed: subTask.is_completed,
                order: subTask.order,
              },
            });
          }
        }
      }

      return board;
    });

    const boardWithSummary = await prisma.boards.findUnique({
      where: { id: duplicatedBoard.id },
      include: boardSummaryInclude,
    });

    res.status(201).json(boardWithSummary);
  } catch (error) {
    console.error('POST /api/boards/:id/duplicate failed:', error);
    res.status(500).json({ error: 'Server error while duplicating board' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const board = await prisma.boards.findUnique({
      where: { id },
      include: boardDetailInclude,
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

router.put('/:id', async (req, res) => {
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
        background: cleanText(background),
      },
      include: boardSummaryInclude,
    });

    res.status(200).json(updatedBoard);
  } catch (error) {
    console.error('PUT /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating board' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.boards.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting board' });
  }
});

module.exports = router;
