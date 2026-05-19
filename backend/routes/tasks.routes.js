const express = require('express');
const prisma = require('../lib/prisma');
const { cleanText } = require('../utils/text');

const router = express.Router();

const taskInclude = {
  sub_tasks: {
    orderBy: { order: 'asc' },
  },
};

router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.tasks.findMany({
      orderBy: { order: 'asc' },
      include: taskInclude,
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error('GET /api/tasks failed:', error);
    res.status(500).json({ error: 'Server error while loading tasks' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { column_id, title, description, priority, assignee_id, due_date } = req.body;

    if (!column_id || !title || !title.trim()) {
      return res.status(400).json({ error: 'Missing column_id or title' });
    }

    const lastTask = await prisma.tasks.findFirst({
      where: { column_id },
      orderBy: { order: 'desc' },
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
        order: newOrder,
      },
      include: taskInclude,
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('POST /api/tasks failed:', error);
    res.status(500).json({ error: 'Server error while creating task' });
  }
});

router.put('/:id', async (req, res) => {
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
      include: taskInclude,
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('PUT /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating task' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.tasks.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting task' });
  }
});

module.exports = router;
