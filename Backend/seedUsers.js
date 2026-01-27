// seedUsers.js - Create test users for OfficeSphere
// Run this file once to add test users to your database

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// User Model (simplified)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee', 'client'], required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Test users
const testUsers = [
  {
    name: 'Admin User',
    email: 'admin@office.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'John Doe',
    email: 'employee@office.com',
    password: 'emp123',
    role: 'employee'
  },
  {
    name: 'ABC Corporation',
    email: 'client@office.com',
    password: 'client123',
    role: 'client'
  }
];

// Seed function
async function seedUsers() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    // Clear existing users (optional)
    console.log('🗑️  Clearing existing users...');
    await User.deleteMany({});

    // Hash passwords and create users
    console.log('👥 Creating test users...');
    
    for (const userData of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const user = await User.create({
        ...userData,
        password: hashedPassword
      });
      
      console.log(`✅ Created ${user.role}: ${user.email}`);
    }

    console.log('\n🎉 Test users created successfully!');
    console.log('\n📝 You can now login with:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:');
    console.log('  Email: admin@office.com');
    console.log('  Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Employee:');
    console.log('  Email: employee@office.com');
    console.log('  Password: emp123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Client:');
    console.log('  Email: client@office.com');
    console.log('  Password: client123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    process.exit(1);
  }
}

// Run the seed function
seedUsers();