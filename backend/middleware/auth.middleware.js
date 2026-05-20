const prisma = require('../lib/prisma');
const { sanitizeUser, verifyToken } = require('../services/auth.service');

const roleRank = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyToken(token);
    const user = await prisma.users.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = sanitizeUser(user);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function getBoardRole(boardId, userId) {
  const member = await prisma.board_members.findUnique({
    where: {
      board_id_user_id: {
        board_id: boardId,
        user_id: userId,
      },
    },
    select: {
      role: true,
    },
  });

  return member?.role || null;
}

async function requireBoardRole(req, res, boardId, allowedRoles) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const role = await getBoardRole(boardId, req.user.id);
  const allowedRank = Math.min(...allowedRoles.map((item) => roleRank[item]));

  if (!role || roleRank[role] < allowedRank) {
    res.status(403).json({ error: 'You do not have permission for this board' });
    return null;
  }

  return role;
}

module.exports = {
  getBoardRole,
  requireAuth,
  requireBoardRole,
};
