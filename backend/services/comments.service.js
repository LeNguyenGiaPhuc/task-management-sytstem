const prisma = require('../lib/prisma');

let ensuredCommentsTable = false;

async function ensureTaskCommentsTable() {
  if (ensuredCommentsTable) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_task_comments_task
    ON task_comments(task_id, created_at DESC);
  `);

  ensuredCommentsTable = true;
}

module.exports = {
  ensureTaskCommentsTable,
};
