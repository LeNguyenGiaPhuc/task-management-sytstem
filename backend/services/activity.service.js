const prisma = require('../lib/prisma');
const { getDemoUserId } = require('./users.service');

async function logBoardActivity(boardId, actionText, userId) {
  if (!boardId || !actionText) return null;

  const actorId = userId || await getDemoUserId();

  return prisma.activity_logs.create({
    data: {
      board_id: boardId,
      user_id: actorId,
      action_text: actionText,
    },
  });
}

module.exports = {
  logBoardActivity,
};
