# Printer Bridge Setup Guide

## ⚠️ Important Architecture Note
You requested to deploy this bridge to **Vercel**. However, **this is not possible** for Direct LAN Printing, and here is why:

*   **Vercel** runs in the "Cloud" (Internet).
*   **Your Printer** is on your "Local Network" (LAN) at `192.168.10.15`.
*   Cloud servers **cannot** connect to your private Local IPs.

**The Solution:**
The **Frontend website** lives on Vercel.
The **Printer Bridge** lives on your **Local Computer** (the POS terminal or laptop in the restaurant).
The Frontend talks to the Bridge via `localhost` (Internal Device Communication), and the Bridge talks to the Printer.

```
[ Frontend (Vercel) ]  ---> [ Browser (Your PC) ]  ---> [ Bridge (Your PC) ]  ---> [ Printer (LAN) ]
      (Internet)                (Localhost)                 (127.0.0.1)           (192.168.10.15)
```

## Setup Instructions

### 1. Prerequisites
*   The computer connected to the printer (or on the same Wi-Fi) must have **Node.js** installed.
    *   Download: [https://nodejs.org/](https://nodejs.org/) (LTS Version)

### 2. Installation (One Time)
1.  Open your terminal or command prompt.
2.  Navigate to the project folder:
    ```bash
    cd "User Files/ASU/Internship/QR Code again/printer-bridge"
    ```
3.  Install the required dependencies:
    ```bash
    npm install
    ```

### 3. Running the Bridge
Whenever you open your restaurant, you must start the bridge.

**Option A: Manual Start**
1.  Open Terminal.
2.  Run:
    ```bash
    npm start
    ```
3.  Keep this window open. You will see: `Printer Bridge Server running on http://localhost:3001`

**Option B: Auto-Start (Recommended)**
To make it start automatically when the computer turns on, we will use the **Windows Startup Folder**. This is easier and more reliable than PM2 on Windows.

1.  **Right-click** the `start_bridge.bat` file you just created.
2.  Choose **Create Shortcut** (it will create a file like `start_bridge - Shortcut`).
3.  Press **Windows Key + R** on your keyboard.
4.  Type `shell:startup` and press **Enter**.
    *   *This opens the folder where Windows looks for programs to start automatically.*
5.  **Drag and drop** the shortcut you created into this folder.

That's it! Next time you restart the computer, the Printer Bridge will open automatically.

## Verifying It Works
1.  Ensure the bridge is running.
2.  Open your Vercel-hosted App.
3.  Go to **Admin > Printer Management**.
4.  Click **"Add Printer"**.
    *   **IP:** 192.168.10.15 (Your specific printer IP)
    *   **Port:** 9100 (Default)
    *   **Type:** Kitchen
5.  Click **Save**.
6.  Click **"Test Print"**.
    *   You should see a log in your terminal: `Connecting to printer... Data sent.`
    *   The printer should print a small test ticket.

## Troubleshooting
*   **"Direct print failed"**: Check if the black terminal window with `npm start` is running.
*   **"Printer connection timeout"**: Check if your computer is on the same Wi-Fi/Ethernet as the printer. Ping the printer IP from your terminal: `ping 192.168.10.15`
*   **Windows Error: "npm.ps1 cannot be loaded because running scripts is disabled"**:
    *   This is a Windows security setting in PowerShell.
    *   **Fix:** Run this command in PowerShell:
        ```powershell
        Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
        ```
    *   Press `Y` when asked. Then try `npm install` again.
    *   *Alternative:* Use **Command Prompt (cmd)** instead of PowerShell.

## Moving to Another Computer
If you want to run this bridge on a different computer (e.g., the dedicated POS terminal):

1.  **Copy the Folder**: You can copy the entire `printer-bridge` folder to the new computer.
    *   *Tip: You don't need to copy the `node_modules` folder. It's cleaner to delete it before copying and reinstall it on the new machine.*
2.  **Install Node.js**: The new computer **MUST** have Node.js installed.
    *   Download: [https://nodejs.org/](https://nodejs.org/)
3.  **Install Dependencies**:
    *   Open terminal in the new folder.
    *   Run `npm install` (this recreates the `node_modules` folder).
4.  **Start the Bridge**: Run `npm start`.

