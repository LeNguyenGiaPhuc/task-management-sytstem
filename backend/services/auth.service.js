const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-task-manager-secret';
const TOKEN_EXPIRES_IN = '7d';

let ensuredAuthColumn = false;

async function ensureAuthColumn() {
  if (ensuredAuthColumn) return;

  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);

  ensuredAuthColumn = true;
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

async function getUserWithPasswordByEmail(email) {
  await ensureAuthColumn();
  const users = await prisma.$queryRawUnsafe(
    `
      SELECT id, email, name, avatar_url, password_hash
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    email
  );

  return users[0] || null;
}

module.exports = {
  comparePassword,
  ensureAuthColumn,
  getUserWithPasswordByEmail,
  hashPassword,
  sanitizeUser,
  signToken,
  verifyToken,
};
