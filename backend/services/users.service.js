const prisma = require('../lib/prisma');

const DEMO_USER_EMAIL = 'demo@task-manager.local';

async function getDemoUserId() {
  const user = await prisma.users.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: 'Demo User',
    },
  });

  return user.id;
}

module.exports = {
  DEMO_USER_EMAIL,
  getDemoUserId,
};
