const prisma = require('./lib/prisma');
const { ensureAuthColumn, hashPassword } = require('./services/auth.service');

const day = 24 * 60 * 60 * 1000;

function dueDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * day);
}

async function ensureUser({ email, name, avatar_url, password }) {
  const user = await prisma.users.upsert({
    where: { email },
    update: { name, avatar_url },
    create: { email, name, avatar_url },
  });

  if (password) {
    const passwordHash = await hashPassword(password);
    await prisma.$executeRawUnsafe(
      'UPDATE users SET password_hash = $1 WHERE id = $2::uuid',
      passwordHash,
      user.id
    );
  }

  return user;
}

async function ensureBoard({ title, description, background, ownerId }) {
  const existingBoard = await prisma.boards.findFirst({
    where: { title, owner_id: ownerId },
  });

  if (existingBoard) {
    return prisma.boards.update({
      where: { id: existingBoard.id },
      data: { description, background },
    });
  }

  return prisma.boards.create({
    data: {
      title,
      description,
      background,
      owner_id: ownerId,
    },
  });
}

async function ensureBoardMember({ boardId, userId, role }) {
  return prisma.board_members.upsert({
    where: {
      board_id_user_id: {
        board_id: boardId,
        user_id: userId,
      },
    },
    update: { role },
    create: {
      board_id: boardId,
      user_id: userId,
      role,
    },
  });
}

async function ensureColumn({ boardId, title, order }) {
  const existingColumn = await prisma.columns.findFirst({
    where: { board_id: boardId, title },
  });

  if (existingColumn) {
    return prisma.columns.update({
      where: { id: existingColumn.id },
      data: { order },
    });
  }

  return prisma.columns.create({
    data: {
      board_id: boardId,
      title,
      order,
    },
  });
}

async function ensureTask({
  columnId,
  title,
  description,
  priority,
  assigneeId,
  dueDateValue,
  order,
}) {
  const existingTask = await prisma.tasks.findFirst({
    where: { column_id: columnId, title },
  });

  const data = {
    description,
    priority,
    assignee_id: assigneeId,
    due_date: dueDateValue,
    order,
  };

  if (existingTask) {
    return prisma.tasks.update({
      where: { id: existingTask.id },
      data,
    });
  }

  return prisma.tasks.create({
    data: {
      column_id: columnId,
      title,
      ...data,
    },
  });
}

async function ensureSubTask({ taskId, title, isCompleted, order }) {
  const existingSubTask = await prisma.sub_tasks.findFirst({
    where: { task_id: taskId, title },
  });

  if (existingSubTask) {
    return prisma.sub_tasks.update({
      where: { id: existingSubTask.id },
      data: {
        is_completed: isCompleted,
        order,
      },
    });
  }

  return prisma.sub_tasks.create({
    data: {
      task_id: taskId,
      title,
      is_completed: isCompleted,
      order,
    },
  });
}

async function ensureActivityLog({ boardId, userId, actionText }) {
  const existingLog = await prisma.activity_logs.findFirst({
    where: {
      board_id: boardId,
      action_text: actionText,
    },
  });

  if (existingLog) return existingLog;

  return prisma.activity_logs.create({
    data: {
      board_id: boardId,
      user_id: userId,
      action_text: actionText,
    },
  });
}

async function ensureAttachment({ taskId, fileName, fileUrl, uploadedBy }) {
  const existingAttachment = await prisma.task_attachments.findFirst({
    where: {
      task_id: taskId,
      file_name: fileName,
    },
  });

  if (existingAttachment) return existingAttachment;

  return prisma.task_attachments.create({
    data: {
      task_id: taskId,
      file_name: fileName,
      file_url: fileUrl,
      uploaded_by: uploadedBy,
    },
  });
}

async function seed() {
  await ensureAuthColumn();

  const owner = await ensureUser({
    email: 'demo@task-manager.local',
    name: 'Demo Owner',
    avatar_url: 'https://api.dicebear.com/8.x/initials/svg?seed=DO',
    password: 'password123',
  });
  const designer = await ensureUser({
    email: 'designer@task-manager.local',
    name: 'Product Designer',
    avatar_url: 'https://api.dicebear.com/8.x/initials/svg?seed=PD',
    password: 'password123',
  });
  const engineer = await ensureUser({
    email: 'engineer@task-manager.local',
    name: 'Fullstack Engineer',
    avatar_url: 'https://api.dicebear.com/8.x/initials/svg?seed=FE',
    password: 'password123',
  });

  const jiraBoard = await ensureBoard({
    title: 'Jira Clone Roadmap',
    description: 'Sample workspace for testing board, task, checklist, and drag-drop flows.',
    background: '#f8fafc',
    ownerId: owner.id,
  });

  await ensureBoardMember({ boardId: jiraBoard.id, userId: owner.id, role: 'OWNER' });
  await ensureBoardMember({ boardId: jiraBoard.id, userId: designer.id, role: 'ADMIN' });
  await ensureBoardMember({ boardId: jiraBoard.id, userId: engineer.id, role: 'MEMBER' });

  const backlog = await ensureColumn({ boardId: jiraBoard.id, title: 'Backlog', order: 1000 });
  const todo = await ensureColumn({ boardId: jiraBoard.id, title: 'To Do', order: 2000 });
  const progress = await ensureColumn({ boardId: jiraBoard.id, title: 'In Progress', order: 3000 });
  const review = await ensureColumn({ boardId: jiraBoard.id, title: 'Review', order: 4000 });
  const done = await ensureColumn({ boardId: jiraBoard.id, title: 'Done', order: 5000 });

  const tasks = [
    {
      column: backlog,
      title: 'Design workspace dashboard states',
      description: 'Create empty, loading, search, and populated states for the workspace dashboard.',
      priority: 'HIGH',
      assigneeId: designer.id,
      due: 5,
      order: 1000,
      subtasks: [
        ['Audit current home page layout', true],
        ['Sketch card density and metadata', false],
        ['Review neutral color palette', false],
      ],
    },
    {
      column: backlog,
      title: 'Plan board permissions model',
      description: 'Map OWNER, ADMIN, and MEMBER permissions before adding invite flows.',
      priority: 'MEDIUM',
      assigneeId: owner.id,
      due: 9,
      order: 2000,
      subtasks: [
        ['List protected board actions', true],
        ['Define route-level checks', false],
      ],
    },
    {
      column: todo,
      title: 'Build task activity timeline',
      description: 'Show task creation, movement, priority changes, and checklist updates.',
      priority: 'MEDIUM',
      assigneeId: engineer.id,
      due: 7,
      order: 1000,
      subtasks: [
        ['Add activity log API query', false],
        ['Render timeline in task modal', false],
      ],
    },
    {
      column: todo,
      title: 'Add member invite screen',
      description: 'Allow board owners to invite members and choose a role.',
      priority: 'LOW',
      assigneeId: owner.id,
      due: 14,
      order: 2000,
      subtasks: [
        ['Create invite modal', false],
        ['Validate duplicate members', false],
      ],
    },
    {
      column: progress,
      title: 'Improve drag-drop order persistence',
      description: 'Validate order calculation when moving tasks between filtered columns.',
      priority: 'URGENT',
      assigneeId: engineer.id,
      due: 2,
      order: 1000,
      subtasks: [
        ['Reproduce filtered reorder issue', true],
        ['Lock drag while filters are active', true],
        ['Add regression notes', false],
      ],
    },
    {
      column: progress,
      title: 'Polish task detail modal',
      description: 'Tighten spacing, priority controls, due-date editing, and checklist interactions.',
      priority: 'HIGH',
      assigneeId: designer.id,
      due: 4,
      order: 2000,
      subtasks: [
        ['Adjust form rhythm', true],
        ['Improve destructive action placement', false],
      ],
    },
    {
      column: review,
      title: 'Review sample data seed',
      description: 'Ensure the seed script is idempotent and creates realistic demo data.',
      priority: 'MEDIUM',
      assigneeId: engineer.id,
      due: 3,
      order: 1000,
      subtasks: [
        ['Run seed twice', false],
        ['Check UI counts', false],
      ],
    },
    {
      column: done,
      title: 'Create board CRUD endpoints',
      description: 'Create, update, delete, duplicate, and list boards with summary metadata.',
      priority: 'HIGH',
      assigneeId: engineer.id,
      due: -1,
      order: 1000,
      subtasks: [
        ['Create update route', true],
        ['Create delete route', true],
        ['Create duplicate route', true],
      ],
    },
  ];

  for (const item of tasks) {
    const task = await ensureTask({
      columnId: item.column.id,
      title: item.title,
      description: item.description,
      priority: item.priority,
      assigneeId: item.assigneeId,
      dueDateValue: dueDate(item.due),
      order: item.order,
    });

    for (let index = 0; index < item.subtasks.length; index += 1) {
      const [subTaskTitle, isCompleted] = item.subtasks[index];
      await ensureSubTask({
        taskId: task.id,
        title: subTaskTitle,
        isCompleted,
        order: (index + 1) * 1000,
      });
    }
  }

  const doneTask = await prisma.tasks.findFirst({
    where: {
      column_id: done.id,
      title: 'Create board CRUD endpoints',
    },
  });

  if (doneTask) {
    await ensureAttachment({
      taskId: doneTask.id,
      fileName: 'api-checklist.md',
      fileUrl: 'https://example.com/api-checklist.md',
      uploadedBy: engineer.id,
    });
  }

  await ensureActivityLog({
    boardId: jiraBoard.id,
    userId: owner.id,
    actionText: 'Seeded sample Jira Clone Roadmap board',
  });
  await ensureActivityLog({
    boardId: jiraBoard.id,
    userId: engineer.id,
    actionText: 'Moved task Improve drag-drop order persistence to In Progress',
  });

  const productBoard = await ensureBoard({
    title: 'Product Launch Plan',
    description: 'Sample launch board for testing multiple workspaces and dashboard search.',
    background: '#f8fafc',
    ownerId: owner.id,
  });

  await ensureBoardMember({ boardId: productBoard.id, userId: owner.id, role: 'OWNER' });
  await ensureBoardMember({ boardId: productBoard.id, userId: designer.id, role: 'MEMBER' });

  const launchTodo = await ensureColumn({ boardId: productBoard.id, title: 'Launch To Do', order: 1000 });
  const launchDone = await ensureColumn({ boardId: productBoard.id, title: 'Launch Done', order: 2000 });

  await ensureTask({
    columnId: launchTodo.id,
    title: 'Write release notes',
    description: 'Prepare clear release notes for the first public demo.',
    priority: 'MEDIUM',
    assigneeId: owner.id,
    dueDateValue: dueDate(6),
    order: 1000,
  });
  await ensureTask({
    columnId: launchDone.id,
    title: 'Create project README outline',
    description: 'Document setup, tech stack, and feature list.',
    priority: 'LOW',
    assigneeId: designer.id,
    dueDateValue: dueDate(-2),
    order: 1000,
  });

  await ensureActivityLog({
    boardId: productBoard.id,
    userId: owner.id,
    actionText: 'Seeded sample Product Launch Plan board',
  });

  console.log('Seed data is ready.');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
