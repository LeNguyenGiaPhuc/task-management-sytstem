const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  comparePassword,
  ensureAuthColumn,
  getUserWithPasswordByEmail,
  hashPassword,
  sanitizeUser,
  signToken,
} = require('../services/auth.service');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = name?.trim();

    if (!normalizedEmail || !trimmedName || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and 6+ character password are required' });
    }

    await ensureAuthColumn();
    const existingUser = await getUserWithPasswordByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await hashPassword(password);
    const users = await prisma.$queryRawUnsafe(
      `
        INSERT INTO users (email, name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, avatar_url
      `,
      normalizedEmail,
      trimmedName,
      passwordHash
    );
    const user = sanitizeUser(users[0]);
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('POST /api/auth/register failed:', error);
    res.status(500).json({ error: 'Server error while registering' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getUserWithPasswordByEmail(normalizedEmail);
    const isValidPassword = await comparePassword(password, user?.password_hash);

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const cleanUser = sanitizeUser(user);
    const token = signToken(cleanUser);

    res.status(200).json({ token, user: cleanUser });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    res.status(500).json({ error: 'Server error while logging in' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = router;
