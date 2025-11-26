# 🔓 How to Disable Vercel Login Requirement

If customers are seeing a Vercel login screen when scanning the QR code, it means **"Deployment Protection"** is enabled. Here is how to turn it off so anyone can access your menu.

## Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com/dashboard
2. Click on your project: **qr-restaurant-ordering**

## Step 2: Access Settings
1. Click the **"Settings"** tab at the top.
2. In the left sidebar, click **"Deployment Protection"**.

## Step 3: Disable Authentication
1. Find the section **"Vercel Authentication"**.
2. **Toggle the switch to OFF** (it should be gray, not black/white).
3. If you see **"Password Protection"**, make sure that is also **OFF**.
4. Click **"Save"** if prompted.

## Step 4: Verify
1. Open an Incognito/Private window.
2. Visit your URL: `https://qr-restaurant-ordering-8qsnbqlee-pranavsunil-3491s-projects.vercel.app`
3. It should load the app directly without asking for a login.

---

**Note:** This setting is often enabled by default for "Preview" deployments, but sometimes it gets enabled for Production too if the team settings are strict. Disabling it makes your site public, which is exactly what you want for a restaurant menu!
