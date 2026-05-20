const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireBoardRole } = require('../middleware/auth.middleware');
const { logBoardActivity } = require('../services/activity.service');

const router = express.Router();

router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { board_id, title } = req.body;

    if (!board_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing board_id or title' });
    }

    const role = await requireBoardRole(req, res, board_id, ['ADMIN', 'OWNER']);
    if (!role) return;

    const lastColumn = await prisma.columns.findFirst({
      where: { board_id },
      orderBy: { order: 'desc' },
    });
    const newOrder = lastColumn ? lastColumn.order + 1000 : 1000;

    const newColumn = await prisma.columns.create({
      data: {
        board_id,
        title: title.trim(),
        order: newOrder,
      },
    });

    await logBoardActivity(board_id, `Created column ${newColumn.title}`, req.user.id);

    res.status(201).json(newColumn);
  } catch (error) {
    console.error('POST /api/columns failed:', error);
    res.status(500).json({ error: 'Server error while creating column' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const existingColumn = await prisma.columns.findUnique({
      where: { id },
      select: { board_id: true, title: true },
    });

    if (!existingColumn) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const role = await requireBoardRole(req, res, existingColumn.board_id, ['ADMIN', 'OWNER']);
    if (!role) return;

    const updatedColumn = await prisma.columns.update({
      where: { id },
      data: { title: title.trim() },
    });

    await logBoardActivity(
      existingColumn.board_id,
      `Renamed column ${existingColumn.title} to ${updatedColumn.title}`,
      req.user.id
    );

    res.status(200).json(updatedColumn);
  } catch (error) {
    console.error('PUT /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating column' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const column = await prisma.columns.findUnique({
      where: { id },
      select: { board_id: true, title: true },
    });

    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const role = await requireBoardRole(req, res, column.board_id, ['ADMIN', 'OWNER']);
    if (!role) return;

    await prisma.columns.delete({ where: { id } });
    await logBoardActivity(column.board_id, `Deleted column ${column.title}`, req.user.id);
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting column' });
  }
});

module.exports = router;
