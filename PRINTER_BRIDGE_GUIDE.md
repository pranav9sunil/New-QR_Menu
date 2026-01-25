# Printer Bridge Setup Guide (macOS Edition)

## ⚠️ Important Architecture Note
The **Printer Bridge** must run on the **local computer** (Mac) that is on the same network as your printers. The cloud-hosted website (Vercel) talks to this bridge via `localhost`, and the bridge talks to the printers.

```
[ Frontend (Vercel) ]  ---> [ Browser (Your Mac) ]  ---> [ Bridge (Your Mac) ]  ---> [ Printer (LAN/USB) ]
      (Internet)                (Localhost)                 (127.0.0.1)           (192.168.x.x or USB)
```

## Setup Instructions

### 1. Prerequisites
*   **Node.js**: Your Mac must have Node.js installed.
    *   Verify by opening Terminal and typing: `node -v`
    *   If not found, download & install from: [https://nodejs.org/](https://nodejs.org/) (LTS Version)

### 2. Installation
1.  **Download** the `printer-bridge-mac-pro.zip` provided to you.
2.  **Extract** the zip file to a stable folder (e.g., `Documents/printer-bridge`).
    *   *Note: Do not move this folder after setup, or the service will break.*
3.  **Open Terminal**:
    *   Press `Cmd + Space`, type `Terminal`, and press Enter.
4.  **Navigate to the folder**:
    *   Type `cd ` (with a space).
    *   Drag and drop the `printer-bridge` folder from Finder into the Terminal window.
    *   Press **Enter**.

### 3. Setup Persistent Service (Auto-Start)
This will set up the bridge to run automatically in the background whenever your Mac starts.

1.  **Run the Setup Script**:
    Copy and paste this command into your Terminal:
    ```bash
    chmod +x setup_mac_service.sh && ./setup_mac_service.sh
    ```
2.  **Verify**:
    *   You should see: `✅ Printer Bridge Service Installed!`
    *   To check if it's running immediately, open: [http://localhost:3001](http://localhost:3001). You should see `Cannot GET /` (which means the server is active) or use the "Test Print" in Admin.

The bridge is now running in the background and will restart automatically if it crashes or if you restart your Mac.

### 4. Managing the Service (Optional)
*   **Stop Service**: `launchctl unload ~/Library/LaunchAgents/com.thali.printerbridge.plist`
*   **Start Service**: `launchctl load ~/Library/LaunchAgents/com.thali.printerbridge.plist`
*   **View Logs**: `tail -f bridge.log` (Run inside the printer-bridge folder)

---

## Managing Printers

### A. Network Printers (Ethernet / Wi-Fi)
If your printers are connected to the router.

1.  **Find the IP Address**: Turn the printer OFF. Hold the FEED button. Turn it ON. Release FEED after 3 seconds. The IP will be on the printed slip (e.g., `192.168.1.50`).
2.  **Add in Admin Panel**:
    *   **Name**: Desired Name (e.g., "Kitchen")
    *   **Type**: Kitchen / Bar / Receipt
    *   **Interface**: `Network`
    *   **IP**: `192.168.1.50` (The IP found above)
    *   **Port**: `9100` (Default)

### B. USB Printers
If your printers are plugged directly into the Mac.

1.  **Find the System Name**:
    *   Open **System Settings** > **Printers & Scanners**.
    *   Find the exact name of your printer (e.g., `EPSON_TM_T88V`, `Star_TSP100`).
2.  **Add in Admin Panel**:
    *   **Name**: Desired Name (e.g., "Counter Printer")
    *   **Type**: Receipt
    *   **Interface**: `USB / System`
    *   **System Printer Name**: Enter the exact name from System Settings (e.g., `EPSON_TM_T88V`).

---

## Troubleshooting on Mac

*   **"Permission denied" for start script**:
    *   Run `chmod +x start_bridge.sh` again.

*   **"Address already in use"**:
    *   Another instance might be running. Close all Terminal windows and try again.
    *   Or find and kill it: `lsof -i :3001` then `kill -9 <PID>`.

*   **"Test Print failed"**:
    *   Check if the Terminal window is still open and running.
    *   Check if your Mac is connected to the same Wi-Fi as the printer (for Network printers).
    *   Check if the USB cable is secure (for USB printers).
