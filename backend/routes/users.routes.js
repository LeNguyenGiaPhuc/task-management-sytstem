const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        avatar_url: true,
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.error('GET /api/users failed:', error);
    res.status(500).json({ error: 'Server error while loading users' });
  }
});

module.exports = router;
