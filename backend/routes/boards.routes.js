const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireBoardRole } = require('../middleware/auth.middleware');
const { logBoardActivity } = require('../services/activity.service');
const { cleanText } = require('../utils/text');

const router = express.Router();

router.use(requireAuth);

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
  board_members: {
    orderBy: { joined_at: 'asc' },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar_url: true,
        },
      },
    },
  },
  activity_logs: {
    orderBy: { created_at: 'desc' },
    take: 12,
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar_url: true,
        },
      },
    },
  },
  columns: {
    orderBy: { order: 'asc' },
    include: {
      tasks: {
        orderBy: { order: 'asc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar_url: true,
            },
          },
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
      where: {
        board_members: {
          some: {
            user_id: req.user.id,
          },
        },
      },
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
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const ownerId = req.user.id;
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

    await logBoardActivity(newBoard.id, `Created board ${newBoard.title}`, ownerId);

    res.status(201).json(newBoard);
  } catch (error) {
    console.error('POST /api/boards failed:', error);
    res.status(500).json({ error: 'Server error while creating board' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const role = await requireBoardRole(req, res, id, ['MEMBER', 'ADMIN', 'OWNER']);
    if (!role) return;

    const ownerId = req.user.id;
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

    await logBoardActivity(
      duplicatedBoard.id,
      `Duplicated board from ${sourceBoard.title}`,
      ownerId
    );

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
    const role = await requireBoardRole(req, res, id, ['MEMBER', 'ADMIN', 'OWNER']);
    if (!role) return;

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
    const role = await requireBoardRole(req, res, id, ['ADMIN', 'OWNER']);
    if (!role) return;

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

    await logBoardActivity(id, `Updated board ${updatedBoard.title}`, req.user.id);

    res.status(200).json(updatedBoard);
  } catch (error) {
    console.error('PUT /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating board' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;
    const actorRole = await requireBoardRole(req, res, id, ['ADMIN', 'OWNER']);
    if (!actorRole) return;

    if (role === 'OWNER' && actorRole !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can add another owner' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    const memberRole = role || 'MEMBER';
    const member = await prisma.board_members.upsert({
      where: {
        board_id_user_id: {
          board_id: id,
          user_id,
        },
      },
      update: { role: memberRole },
      create: {
        board_id: id,
        user_id,
        role: memberRole,
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    await logBoardActivity(id, `Added ${member.users.name} as ${member.role}`, req.user.id);

    res.status(201).json(member);
  } catch (error) {
    console.error('POST /api/boards/:id/members failed:', error);
    res.status(500).json({ error: 'Server error while adding board member' });
  }
});

router.put('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const actorRole = await requireBoardRole(req, res, id, ['OWNER']);
    if (!actorRole) return;

    if (!role) {
      return res.status(400).json({ error: 'Missing role' });
    }

    const member = await prisma.board_members.update({
      where: {
        board_id_user_id: {
          board_id: id,
          user_id: userId,
        },
      },
      data: { role },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    await logBoardActivity(id, `Changed ${member.users.name} role to ${member.role}`, req.user.id);

    res.status(200).json(member);
  } catch (error) {
    console.error('PUT /api/boards/:id/members/:userId failed:', error);
    res.status(500).json({ error: 'Server error while updating board member' });
  }
});

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const actorRole = await requireBoardRole(req, res, id, ['ADMIN', 'OWNER']);
    if (!actorRole) return;

    const member = await prisma.board_members.findUnique({
      where: {
        board_id_user_id: {
          board_id: id,
          user_id: userId,
        },
      },
      include: {
        users: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Board member not found' });
    }

    if (member.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot remove board owner' });
    }

    await prisma.board_members.delete({
      where: {
        board_id_user_id: {
          board_id: id,
          user_id: userId,
        },
      },
    });

    await logBoardActivity(id, `Removed ${member.users.name} from board`, req.user.id);

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/boards/:id/members/:userId failed:', error);
    res.status(500).json({ error: 'Server error while removing board member' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const role = await requireBoardRole(req, res, id, ['OWNER']);
    if (!role) return;

    await prisma.boards.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/boards/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting board' });
  }
});

module.exports = router;
