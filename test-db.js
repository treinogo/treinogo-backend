// Test database connection
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Check if tables exist
    try {
      const users = await prisma.user.findMany({ take: 1 });
      console.log('✅ User table exists and accessible');
    } catch (error) {
      console.log('❌ User table does not exist or is not accessible');
      console.log('Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('DATABASE_URL')) {
      console.log('🔧 Check your DATABASE_URL environment variable');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();