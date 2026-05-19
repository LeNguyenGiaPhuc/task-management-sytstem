const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { task_id, title } = req.body;

    if (!task_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing task_id or title' });
    }

    const lastSubTask = await prisma.sub_tasks.findFirst({
      where: { task_id },
      orderBy: { order: 'desc' },
    });
    const newOrder = lastSubTask ? lastSubTask.order + 1000 : 1000;

    const newSubTask = await prisma.sub_tasks.create({
      data: {
        task_id,
        title: title.trim(),
        order: newOrder,
      },
    });

    res.status(201).json(newSubTask);
  } catch (error) {
    console.error('POST /api/subtasks failed:', error);
    res.status(500).json({ error: 'Server error while creating subtask' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_completed, order } = req.body;
    const data = {};

    if (title !== undefined) data.title = title.trim();
    if (is_completed !== undefined) data.is_completed = Boolean(is_completed);
    if (order !== undefined) data.order = Number(order);

    const updatedSubTask = await prisma.sub_tasks.update({
      where: { id },
      data,
    });

    res.status(200).json(updatedSubTask);
  } catch (error) {
    console.error('PUT /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating subtask' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.sub_tasks.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting subtask' });
  }
});

module.exports = router;
