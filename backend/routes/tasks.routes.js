const express = require('express');
const prisma = require('../lib/prisma');
const { logBoardActivity } = require('../services/activity.service');
const { cleanText } = require('../utils/text');

const router = express.Router();

const taskInclude = {
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

    const column = await prisma.columns.findUnique({
      where: { id: column_id },
      select: { board_id: true },
    });
    if (column) {
      await logBoardActivity(column.board_id, `Created task ${newTask.title}`);
    }

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
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'Missing title' });
      data.title = title.trim();
    }
    if (description !== undefined) data.description = cleanText(description);
    if (priority !== undefined) data.priority = priority;
    if (assignee_id !== undefined) data.assignee_id = assignee_id || null;
    if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null;

    const existingTask = await prisma.tasks.findUnique({
      where: { id },
      include: {
        columns: {
          select: {
            board_id: true,
            title: true,
          },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await prisma.tasks.update({
      where: { id },
      data,
      include: taskInclude,
    });

    let actionText = `Updated task ${updatedTask.title}`;
    if (column_id !== undefined && column_id !== existingTask.column_id) {
      const destinationColumn = await prisma.columns.findUnique({
        where: { id: column_id },
        select: { title: true },
      });
      actionText = `Moved task ${updatedTask.title} to ${destinationColumn?.title || 'another column'}`;
    } else if (assignee_id !== undefined) {
      actionText = updatedTask.users
        ? `Assigned task ${updatedTask.title} to ${updatedTask.users.name}`
        : `Unassigned task ${updatedTask.title}`;
    } else if (priority !== undefined && priority !== existingTask.priority) {
      actionText = `Changed ${updatedTask.title} priority to ${updatedTask.priority}`;
    }

    await logBoardActivity(existingTask.columns.board_id, actionText);

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('PUT /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while updating task' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.tasks.findUnique({
      where: { id },
      include: {
        columns: {
          select: {
            board_id: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.tasks.delete({ where: { id } });
    await logBoardActivity(task.columns.board_id, `Deleted task ${task.title}`);
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/tasks/:id failed:', error);
    res.status(500).json({ error: 'Server error while deleting task' });
  }
});

module.exports = router;
