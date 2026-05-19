const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { board_id, title } = req.body;

    if (!board_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing board_id or title' });
    }

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

    const updatedColumn = await prisma.columns.update({
      where: { id },
      data: { title: title.trim() },
    });

    res.status(200).json(updatedColumn);
  } catch (error) {
    console.error('PUT /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating column' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.columns.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/columns/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting column' });
  }
});

module.exports = router;
