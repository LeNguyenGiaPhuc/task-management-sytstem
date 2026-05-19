require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Dang ket noi den Supabase...');

  const user = await prisma.users.upsert({
    where: { email: 'hello@test.com' },
    update: { name: 'Test User' },
    create: {
      email: 'hello@test.com',
      name: 'Test User',
    },
  });
  console.log('Da tao/cap nhat user thanh cong:', user);

  const allUsers = await prisma.users.findMany();
  console.log('Danh sach users trong database:');
  console.log(allUsers);
}

main()
  .catch((error) => {
    console.error('Co loi xay ra khi ket noi database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Da ngat ket noi database.');
  });
