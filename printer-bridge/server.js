const express = require('express');
const cors = require('cors');
const net = require('net');
const bodyParser = require('body-parser');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// ESC/POS Command Constants
const ESC = '\x1b';
const GS = '\x1d';
const CMD = {
    INIT: ESC + '@',
    CUT: GS + 'V' + '\x41' + '\x00', // Full cut
    TEXT_NORMAL: ESC + '!' + '\x00',
    TEXT_BOLD: ESC + '!' + '\x08',
    TEXT_DOUBLE_HEIGHT: ESC + '!' + '\x10',
    TEXT_DOUBLE_WIDTH: ESC + '!' + '\x20',
    TEXT_SMALL: '\x1b\x4d\x01', // Font B (Small)
    ALIGN_LEFT: ESC + 'a' + '\x00',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_RIGHT: ESC + 'a' + '\x02',
};

// Helper to sanitize text (remove diacritics/special chars if printer doesn't support)
// For now, valid ASCII/Latin-1 usually works on POS80.
function sanitize(text) {
    return text || '';
}

function buildReceiptBuffer(data) {
    let commands = [];

    // --- 1. Header (Title & Address) ---
    commands.push(CMD.INIT);
    commands.push(CMD.ALIGN_CENTER);

    // Title
    commands.push(CMD.TEXT_BOLD);
    commands.push(CMD.TEXT_DOUBLE_HEIGHT);
    const title = data.header && data.header.title ? data.header.title : (data.title || 'Receipt');
    commands.push(title + '\n');
    commands.push(CMD.TEXT_NORMAL); // Reset

    // Address (if present)
    if (data.header && data.header.address && Array.isArray(data.header.address)) {
        commands.push(CMD.TEXT_NORMAL);
        data.header.address.forEach(line => {
            commands.push(line + '\n');
        });
    }
    commands.push('\n');

    // --- 2. Metadata (Table & Date) ---
    // User requested: "Table number, time and date of the Bill generated"
    // Align: Left or Justified? The image shows "Mesa: ..." tightly packed or left. 
    // Let's do Left Align for clarity.
    commands.push(CMD.ALIGN_LEFT);

    // Fallback for metadata
    const tableName = data.meta && data.meta.tableName ? data.meta.tableName : (data.tableName || 'Unknown');
    const dateStr = data.meta && data.meta.date ? data.meta.date : new Date().toLocaleString();

    commands.push(`Table: ${tableName}\n`);
    commands.push(`Date: ${dateStr}\n`);
    commands.push('------------------------------------------------\n');

    // Headers for columns? Image has "Und. Articulo .... Precio Importe"
    // Let's try to match that simplified: Qty Item Price
    // But keeping it simple first.

    // --- 3. Items ---
    commands.push(CMD.ALIGN_LEFT);
    data.items.forEach(item => {
        // Line format: "1.00  GAMBAS BIRYANI       14.50"
        const qty = item.quantity;
        const qtyStr = `${qty}x `; // Using "x" instead of "1.00" for cleaner look, or match image "1.00"? User said "x" in HTML but image has "1.00". Let's stick to "Item xQty" or "Qty x Name". Current: "Qty x Name".

        const priceStr = (item.price * qty).toFixed(2);

        // POS80 Width ~42-48 chars
        // Format: Qty (4) Name (Variable) Price (8)

        // Name
        const maxCols = 42;
        // We print name first then align price right? 
        // Or Qty Name........Price

        commands.push(CMD.TEXT_BOLD);

        // Print Qty + Name
        // Smart truncation/padding
        const leftPart = `${qty}x ${item.name}`;

        if (data.financials) { // If showing prices
            // Calculate padding
            const spaceNeeded = maxCols - leftPart.length - priceStr.length;
            if (spaceNeeded > 0) {
                commands.push(leftPart + ' '.repeat(spaceNeeded) + priceStr + '\n');
            } else {
                // Name too long, wrap or truncate? 
                // Let's wrap name
                commands.push(leftPart + '\n');
                commands.push(CMD.ALIGN_RIGHT);
                commands.push(priceStr + '\n');
                commands.push(CMD.ALIGN_LEFT);
            }
        } else {
            commands.push(leftPart + '\n');
        }

        commands.push(CMD.TEXT_NORMAL);

        // Customizations & Notes
        if (item.customizations) {
            commands.push(`  + ${item.customizations}\n`);
        }
        if (item.notes) {
            commands.push(CMD.TEXT_SMALL);
            commands.push(`  (Note: ${item.notes})\n`);
            commands.push(CMD.TEXT_NORMAL);
        }
        // commands.push('\n'); // Single spacing? Image is tight.
    });

    commands.push('------------------------------------------------\n');

    // --- 4. Financials (Footer) ---
    if (data.financials) {
        commands.push(CMD.ALIGN_RIGHT);

        // Base
        commands.push(`Base Total: ${data.financials.baseTotal.toFixed(2)}\n`);

        // Tax
        commands.push(`Tax (10%): ${data.financials.taxAmount.toFixed(2)}\n`);

        commands.push('\n');

        // Total
        commands.push(CMD.TEXT_BOLD);
        commands.push(CMD.TEXT_DOUBLE_HEIGHT);
        // commands.push(CMD.TEXT_DOUBLE_WIDTH); // Too wide maybe?
        commands.push(`TOTAL: ${data.financials.total.toFixed(2)} EUR\n`);
        commands.push(CMD.TEXT_NORMAL);
    }
    else if (data.total !== undefined) {
        // Legacy/Full Fallback
        commands.push(CMD.ALIGN_RIGHT);
        commands.push(CMD.TEXT_BOLD);
        commands.push(`TOTAL: ${data.total.toFixed(2)}\n`);
    }

    commands.push('\n');
    commands.push(CMD.ALIGN_CENTER);
    commands.push('GRACIAS POR SU VISITA\n');

    // --- 5. Cut ---
    commands.push(CMD.INIT);
    commands.push('\n\n\n\n');
    commands.push(CMD.CUT);

    return Buffer.concat(commands.map(c => Buffer.from(c, 'binary')));
}

app.post('/print', (req, res) => {
    // Support new payload structure: { printer: { type, ip, port, name }, data: ... }
    // Fallback for legacy: { ip, port, data } -> treat as network
    let printer = req.body.printer;
    let data = req.body.data;

    // Legacy fallback
    if (!printer && req.body.ip) {
        printer = {
            type: 'network',
            ip: req.body.ip,
            port: req.body.port
        };
    }

    if (!printer || !data) {
        return res.status(400).json({ error: 'Missing printer config or data' });
    }

    const buffer = buildReceiptBuffer(data);

    // Handle USB/System Printer (Windows)
    if (printer.type === 'usb') {
        if (!printer.name) {
            return res.status(400).json({ error: 'Missing printer name for USB/System printing' });
        }

        const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);

        try {
            fs.writeFileSync(tempFilePath, buffer);

            if (os.platform() === 'win32') {
                // Windows: Use PowerShell script
                const scriptPath = path.join(__dirname, 'print_raw.ps1');
                const psCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printer.name}" -FilePath "${tempFilePath}"`;

                console.log(`Printing to Windows USB/Shared: ${printer.name}`);
                exec(psCommand, (error, stdout, stderr) => {
                    cleanup(tempFilePath);
                    if (error) {
                        console.error('Print Error:', stderr || error.message);
                        return res.status(500).json({ error: 'Failed to print: ' + (stderr || error.message) });
                    }
                    console.log('Print Success');
                    res.json({ success: true });
                });

            } else if (os.platform() === 'darwin' || os.platform() === 'linux') {
                // macOS/Linux: Use 'lp' command (CUPS)
                // -d: Destination printer
                // -o raw: Send raw data (ESC/POS) without processing
                const command = `lp -d "${printer.name}" -o raw "${tempFilePath}"`;

                console.log(`Printing to macOS/Linux Printer: ${printer.name}`);
                exec(command, (error, stdout, stderr) => {
                    cleanup(tempFilePath);
                    if (error) {
                        console.error('Print Error:', stderr || error.message);
                        return res.status(500).json({ error: 'Failed to print: ' + (stderr || error.message) });
                    }
                    console.log('Print Success:', stdout);
                    res.json({ success: true });
                });

            } else {
                cleanup(tempFilePath);
                return res.status(400).json({ error: 'USB/System printing not supported on this OS: ' + os.platform() });
            }

        } catch (err) {
            console.error('File Write Error:', err);
            return res.status(500).json({ error: 'Bridge internal error' });
        }
        return;
    }

    function cleanup(path) {
        try { fs.unlinkSync(path); } catch (e) { }
    }

    // Handle Network (Ethernet/Wi-Fi)
    const targetIp = printer.ip;
    const targetPort = printer.port || 9100;
    const client = new net.Socket();

    console.log(`Connecting to network printer at ${targetIp}:${targetPort}...`);

    const timeout = setTimeout(() => {
        client.destroy();
        console.error('Connection timed out');
        if (!res.headersSent) res.status(500).json({ error: 'Printer connection timeout' });
    }, 5000);

    client.connect(targetPort, targetIp, () => {
        clearTimeout(timeout);
        console.log('Connected. Sending data...');
        client.write(buffer, () => {
            console.log('Data sent. Closing connection.');
            client.end();
            if (!res.headersSent) res.json({ success: true });
        });
    });

    client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Printer connection error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to connect to printer: ' + err.message });
    });
});



app.listen(PORT, () => {
    console.log(`Printer Bridge Server running on http://localhost:${PORT}`);
});
