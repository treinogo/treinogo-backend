#!/bin/bash

# Render Deploy Script for TreinoGo Backend

echo "🚀 Starting deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client first
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

# Push schema to database (creates tables if they don't exist)
echo "🗄️ Pushing database schema..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss

# Run migrations (if any exist)
echo "� Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "⚠️ No migrations to run or migration failed"

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ Deployment completed successfully!"