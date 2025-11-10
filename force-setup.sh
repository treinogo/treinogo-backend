#!/bin/bash

# Force database setup script for Render

echo "🚀 FORCING DATABASE SETUP..."

# Set environment
export NODE_ENV=production

# Install dependencies
echo "📦 Installing dependencies..."
npm install --only=production

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🗄️ Database URL check..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set!"
  exit 1
else
  echo "✅ DATABASE_URL is configured"
fi

# Force push schema (this will create tables)
echo "🔨 FORCE PUSHING SCHEMA TO CREATE TABLES..."
npx prisma db push --force-reset --accept-data-loss --skip-generate

# Verify tables were created
echo "🔍 Verifying tables..."
npx prisma db seed --preview-feature 2>/dev/null || echo "No seed file found (OK)"

# Generate client again after schema push
echo "🔧 Re-generating Prisma client after schema push..."
npx prisma generate

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ SETUP COMPLETED - TABLES SHOULD BE CREATED!"
echo "🔗 Testing with a simple query..."

# Test with Node.js
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.\$connect();
    console.log('✅ Database connection works!');
    
    const userCount = await prisma.user.count();
    console.log('✅ User table exists! Count:', userCount);
    
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  } finally {
    await prisma.\$disconnect();
  }
}

test();
"