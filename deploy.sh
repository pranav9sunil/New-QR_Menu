#!/bin/bash

# QR Restaurant Ordering System - Vercel Deployment Script
# This script will deploy your application to Vercel with all Firebase credentials

echo "🚀 QR Restaurant Ordering System - Vercel Deployment"
echo "=================================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

echo "📝 Step 1: Login to Vercel"
echo "This will open your browser for authentication..."
vercel login

echo ""
echo "📦 Step 2: Deploy Project"
echo "Deploying to Vercel..."
vercel --yes

echo ""
echo "🔐 Step 3: Adding Firebase Environment Variables"
echo "Setting up production environment..."

# Add Firebase credentials as environment variables
echo "Adding VITE_FIREBASE_API_KEY..."
echo "AIzaSyAT2acMkrTKsMMaW2aR5aGLTMdYQbje7i8" | vercel env add VITE_FIREBASE_API_KEY production

echo "Adding VITE_FIREBASE_AUTH_DOMAIN..."
echo "qr-ordering-system-c80d4.firebaseapp.com" | vercel env add VITE_FIREBASE_AUTH_DOMAIN production

echo "Adding VITE_FIREBASE_PROJECT_ID..."
echo "qr-ordering-system-c80d4" | vercel env add VITE_FIREBASE_PROJECT_ID production

echo "Adding VITE_FIREBASE_STORAGE_BUCKET..."
echo "qr-ordering-system-c80d4.firebasestorage.app" | vercel env add VITE_FIREBASE_STORAGE_BUCKET production

echo "Adding VITE_FIREBASE_MESSAGING_SENDER_ID..."
echo "380518528753" | vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production

echo "Adding VITE_FIREBASE_APP_ID..."
echo "1:380518528753:web:4893e0ed933138b5f99b50" | vercel env add VITE_FIREBASE_APP_ID production

echo ""
echo "🚀 Step 4: Deploying to Production"
echo "Building and deploying your application..."
vercel --prod

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "=================================================="
echo "📱 Your Application URLs:"
echo "=================================================="
echo ""
echo "🔧 Admin Panel:"
echo "   https://[your-url].vercel.app/admin"
echo ""
echo "👥 Customer Access:"
echo "   Scan QR codes at tables"
echo ""
echo "📊 Vercel Dashboard:"
echo "   https://vercel.com/dashboard"
echo ""
echo "=================================================="
echo ""
echo "Next Steps:"
echo "1. Copy your production URL from above"
echo "2. Login to admin panel: https://[your-url].vercel.app/admin"
echo "3. Go to QR Codes page"
echo "4. Download QR codes for all tables"
echo "5. Print and place at tables"
echo ""
echo "🎉 Your restaurant ordering system is now LIVE!"
echo "=================================================="
