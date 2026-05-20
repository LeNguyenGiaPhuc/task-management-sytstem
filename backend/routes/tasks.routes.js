const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const prisma = require('../lib/prisma');
const { logBoardActivity } = require('../services/activity.service');
const { ensureTaskCommentsTable } = require('../services/comments.service');
const { getDemoUserId } = require('../services/users.service');
const { cleanText } = require('../utils/text');

const router = express.Router();
const uploadDirectory = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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

async function getTaskBoard(taskId) {
  return prisma.tasks.findUnique({
    where: { id: taskId },
    include: {
      columns: {
        select: {
          board_id: true,
        },
      },
    },
  });
}

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

router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureTaskCommentsTable();

    const comments = await prisma.$queryRawUnsafe(
      `
        SELECT
          task_comments.id,
          task_comments.task_id,
          task_comments.user_id,
          task_comments.content,
          task_comments.created_at,
          task_comments.updated_at,
          users.name AS user_name,
          users.email AS user_email,
          users.avatar_url AS user_avatar_url
        FROM task_comments
        LEFT JOIN users ON users.id = task_comments.user_id
        WHERE task_comments.task_id = $1::uuid
        ORDER BY task_comments.created_at DESC
      `,
      id
    );

    res.status(200).json(comments);
  } catch (error) {
    console.error('GET /api/tasks/:id/comments failed:', error);
    res.status(500).json({ error: 'Server error while loading comments' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, user_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Missing content' });
    }

    await ensureTaskCommentsTable();
    const userId = user_id || await getDemoUserId();
    const createdComments = await prisma.$queryRawUnsafe(
      `
        INSERT INTO task_comments (task_id, user_id, content)
        VALUES ($1::uuid, $2::uuid, $3)
        RETURNING id, task_id, user_id, content, created_at, updated_at
      `,
      id,
      userId,
      content.trim()
    );
    const comment = createdComments[0];
    const task = await getTaskBoard(id);

    if (task) {
      await logBoardActivity(task.columns.board_id, `Commented on task ${task.title}`, userId);
    }

    const comments = await prisma.$queryRawUnsafe(
      `
        SELECT
          task_comments.id,
          task_comments.task_id,
          task_comments.user_id,
          task_comments.content,
          task_comments.created_at,
          task_comments.updated_at,
          users.name AS user_name,
          users.email AS user_email,
          users.avatar_url AS user_avatar_url
        FROM task_comments
        LEFT JOIN users ON users.id = task_comments.user_id
        WHERE task_comments.id = $1::uuid
      `,
      comment.id
    );

    res.status(201).json(comments[0]);
  } catch (error) {
    console.error('POST /api/tasks/:id/comments failed:', error);
    res.status(500).json({ error: 'Server error while creating comment' });
  }
});

router.delete('/:taskId/comments/:commentId', async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    await ensureTaskCommentsTable();

    const existingComments = await prisma.$queryRawUnsafe(
      'SELECT id FROM task_comments WHERE id = $1::uuid AND task_id = $2::uuid',
      commentId,
      taskId
    );

    if (!existingComments.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await prisma.$executeRawUnsafe(
      'DELETE FROM task_comments WHERE id = $1::uuid AND task_id = $2::uuid',
      commentId,
      taskId
    );

    const task = await getTaskBoard(taskId);
    if (task) {
      await logBoardActivity(task.columns.board_id, `Deleted a comment from ${task.title}`);
    }

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/tasks/:taskId/comments/:commentId failed:', error);
    res.status(500).json({ error: 'Server error while deleting comment' });
  }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await prisma.task_attachments.findMany({
      where: { task_id: id },
      orderBy: { created_at: 'desc' },
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

    res.status(200).json(attachments);
  } catch (error) {
    console.error('GET /api/tasks/:id/attachments failed:', error);
    res.status(500).json({ error: 'Server error while loading attachments' });
  }
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { file_name, file_url, uploaded_by } = req.body;
    const uploadedFile = req.file;
    const finalFileName = uploadedFile?.originalname || file_name;
    const finalFileUrl = uploadedFile
      ? `/uploads/${uploadedFile.filename}`
      : file_url;

    if (!finalFileName || !finalFileName.trim() || !finalFileUrl || !finalFileUrl.trim()) {
      return res.status(400).json({ error: 'Missing attachment file or URL' });
    }

    const uploadedBy = uploaded_by || await getDemoUserId();
    const attachment = await prisma.task_attachments.create({
      data: {
        task_id: id,
        file_name: finalFileName.trim(),
        file_url: finalFileUrl.trim(),
        uploaded_by: uploadedBy,
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
    const task = await getTaskBoard(id);

    if (task) {
      await logBoardActivity(task.columns.board_id, `Attached ${attachment.file_name} to ${task.title}`, uploadedBy);
    }

    res.status(201).json(attachment);
  } catch (error) {
    console.error('POST /api/tasks/:id/attachments failed:', error);
    res.status(500).json({ error: 'Server error while creating attachment' });
  }
});

router.delete('/:taskId/attachments/:attachmentId', async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    const attachment = await prisma.task_attachments.findFirst({
      where: {
        id: attachmentId,
        task_id: taskId,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await prisma.task_attachments.delete({ where: { id: attachmentId } });
    if (attachment.file_url?.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '..', attachment.file_url.replace(/^\//, ''));
      fs.unlink(localPath, () => {});
    }

    const task = await getTaskBoard(taskId);
    if (task) {
      await logBoardActivity(task.columns.board_id, `Removed attachment ${attachment.file_name} from ${task.title}`);
    }

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/tasks/:taskId/attachments/:attachmentId failed:', error);
    res.status(500).json({ error: 'Server error while deleting attachment' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await getTaskBoard(id);

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
