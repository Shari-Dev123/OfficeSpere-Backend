const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');

dotenv.config(); // loads .env from same folder

const users = [
  {
    name: 'Admin User',
    email: 'admin@office.com',
    password: 'admin123',
    role: 'admin',
  },
];

const seedUsers = async () => {
  try {
    await connectDB();

    await User.deleteMany();
    console.log('🗑️ Old users removed');

    await User.create(users);
    console.log('✅ Users seeded successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder error:', error.message);
    process.exit(1);
  }
};

seedUsers();
