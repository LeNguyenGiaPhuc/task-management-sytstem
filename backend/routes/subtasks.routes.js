const express = require('express');
const prisma = require('../lib/prisma');
const { logBoardActivity } = require('../services/activity.service');

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

    const task = await prisma.tasks.findUnique({
      where: { id: task_id },
      include: {
        columns: {
          select: {
            board_id: true,
          },
        },
      },
    });
    if (task) {
      await logBoardActivity(task.columns.board_id, `Added checklist item to ${task.title}`);
    }

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

    const existingSubTask = await prisma.sub_tasks.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            columns: {
              select: {
                board_id: true,
              },
            },
          },
        },
      },
    });

    if (!existingSubTask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    const updatedSubTask = await prisma.sub_tasks.update({
      where: { id },
      data,
    });

    const actionText =
      is_completed !== undefined
        ? `${updatedSubTask.is_completed ? 'Completed' : 'Reopened'} checklist item on ${existingSubTask.tasks.title}`
        : `Updated checklist item on ${existingSubTask.tasks.title}`;
    await logBoardActivity(existingSubTask.tasks.columns.board_id, actionText);

    res.status(200).json(updatedSubTask);
  } catch (error) {
    console.error('PUT /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating subtask' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const subTask = await prisma.sub_tasks.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            columns: {
              select: {
                board_id: true,
              },
            },
          },
        },
      },
    });

    if (!subTask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await prisma.sub_tasks.delete({ where: { id } });
    await logBoardActivity(subTask.tasks.columns.board_id, `Deleted checklist item from ${subTask.tasks.title}`);
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/subtasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting subtask' });
  }
});

module.exports = router;
