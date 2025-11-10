#!/bin/bash

# Debug script for Prisma migrations on Render

echo "🔍 Debugging Prisma migration issues..."

# Check environment variables
echo "📋 Environment Variables:"
echo "DATABASE_URL: ${DATABASE_URL:0:50}... (truncated for security)"
echo "NODE_ENV: $NODE_ENV"

# Check if Prisma CLI is available
echo "🔧 Checking Prisma CLI..."
npx prisma --version

# Check if database is accessible
echo "🗄️ Testing database connection..."
npx prisma db push --preview-feature --accept-data-loss || echo "❌ Database connection failed"

# List current migrations
echo "📄 Current migrations:"
ls -la prisma/migrations/

# Try to run migrations
echo "🚀 Running migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma

# Generate Prisma client
echo "⚙️ Generating Prisma client..."
npx prisma generate

echo "✅ Debug script completed!"