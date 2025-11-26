# Quick Start: Deploy to Vercel

## Prerequisites
- Git repository pushed to GitHub
- Firebase project credentials
- Vercel account (free)

## 5-Minute Deployment

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy
```bash
cd "/Users/pranav/User Files/ASU/Internship/QR Code again"
vercel
```

Follow the prompts:
- **Set up and deploy?** Y
- **Which scope?** Select your account
- **Link to existing project?** N
- **Project name?** qr-restaurant-ordering
- **In which directory is your code located?** ./
- **Want to override settings?** Y
  - **Build Command:** `cd frontend && npm install && npm run build`
  - **Output Directory:** `frontend/dist`
  - **Development Command:** `cd frontend && npm run dev`

### Step 4: Add Environment Variables

Get your Firebase credentials from Firebase Console → Project Settings → General

```bash
vercel env add VITE_FIREBASE_API_KEY
# Paste your API key when prompted

vercel env add VITE_FIREBASE_AUTH_DOMAIN
# Paste your auth domain

vercel env add VITE_FIREBASE_PROJECT_ID
# Paste your project ID

vercel env add VITE_FIREBASE_STORAGE_BUCKET
# Paste your storage bucket

vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID
# Paste your sender ID

vercel env add VITE_FIREBASE_APP_ID
# Paste your app ID
```

For each variable, select:
- **Environment:** Production, Preview, Development (select all 3)

### Step 5: Deploy to Production
```bash
vercel --prod
```

### Step 6: Get Your URL
Vercel will output your production URL:
```
✅ Production: https://qr-restaurant-ordering.vercel.app
```

### Step 7: Update QR Codes
1. Visit `https://your-url.vercel.app/admin`
2. Login with admin credentials
3. Go to "QR Codes" page
4. Download QR codes for all tables
5. Print and place at tables

## Alternative: Deploy via Vercel Dashboard

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### Step 2: Import to Vercel
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your repository
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** ./
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/dist`

### Step 3: Add Environment Variables
In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add each Firebase variable
3. Select all environments (Production, Preview, Development)

### Step 4: Deploy
Click "Deploy" button

## Testing Your Deployment

### Test Customer Flow
1. Open your Vercel URL on mobile: `https://your-url.vercel.app`
2. Navigate to `/signup?tableId=test`
3. Enter customer details
4. Browse menu and place test order

### Test Admin Flow
1. Open `https://your-url.vercel.app/admin`
2. Login with admin credentials
3. Check Kitchen page for test order
4. Verify Live Bills page
5. Download QR codes

## Troubleshooting

### Build Fails
**Error:** `Cannot find module 'vite'`
**Solution:** Ensure `package.json` has all dependencies

### Environment Variables Not Working
**Error:** `Firebase: Error (auth/invalid-api-key)`
**Solution:** 
1. Check variables are set in Vercel Dashboard
2. Ensure variable names start with `VITE_`
3. Redeploy after adding variables

### 404 on Routes
**Error:** Refreshing page shows 404
**Solution:** Ensure `vercel.json` has rewrites configured (already done)

## Continuous Deployment

Once set up, every push to GitHub automatically deploys:

```bash
# Make changes
git add .
git commit -m "Update menu"
git push origin main

# Vercel automatically builds and deploys!
```

## Next Steps

✅ Deployment complete!
✅ Test thoroughly
✅ Generate QR codes
✅ Print and laminate QR codes
✅ Place at tables
✅ Train staff on admin panel
✅ Launch! 🚀

## Support

- Vercel Docs: https://vercel.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Your deployment logs: https://vercel.com/dashboard

---

**Your app is now live and accessible from any device! 🎉**
