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

    // 1. Initialize
    commands.push(CMD.INIT);
    commands.push(CMD.ALIGN_CENTER);

    // 2. Title
    commands.push(CMD.TEXT_BOLD);
    commands.push(CMD.TEXT_DOUBLE_HEIGHT);
    commands.push(data.title + '\n');
    commands.push(CMD.TEXT_NORMAL); // Reset
    commands.push('\n');

    // 3. Metadata (Table & Date)
    commands.push(CMD.ALIGN_LEFT);
    commands.push(`Table: ${data.tableName}\n`);
    commands.push(`Date: ${new Date().toLocaleString()}\n`);
    commands.push('------------------------------------------------\n');

    // 4. Items
    data.items.forEach(item => {
        // Line 1: Qty x Name ....... Price
        // Calculate spacing
        const qtyStr = `${item.quantity}x `;
        const priceStr = data.showPrices ? ` ${item.price.toFixed(2)}` : '';

        // POS80 usually has ~48 columns in Font A
        const maxCols = 42; // Safe margin
        const spaceForName = maxCols - qtyStr.length - priceStr.length;

        let name = item.name.substring(0, spaceForName);

        // If name is too short, pad with spaces to align price right
        // Actually, simple way: Left align Qty+Name, space, then price? 
        // Let's try flexible spacing.

        commands.push(CMD.TEXT_BOLD);
        commands.push(qtyStr + name);

        if (data.showPrices) {
            // Pad spaces
            const padding = ' '.repeat(Math.max(1, maxCols - (qtyStr.length + name.length + priceStr.length)));
            commands.push(padding + priceStr);
        }
        commands.push('\n');

        // Reset to normal for details/notes
        commands.push(CMD.TEXT_NORMAL);

        // Customizations
        if (item.customizations) {
            commands.push(`  + ${item.customizations}\n`);
        }

        // Notes (Small Font)
        if (item.notes) {
            commands.push(CMD.TEXT_SMALL);
            commands.push(`  NOTE: ${item.notes}\n`);
            commands.push(CMD.TEXT_NORMAL); // Reset font
        }

        commands.push('\n'); // Spacing between items
    });

    commands.push('------------------------------------------------\n');

    // 5. Totals (if enabled)
    if (data.showPrices && data.total !== undefined) {
        commands.push(CMD.ALIGN_RIGHT);
        commands.push(CMD.TEXT_BOLD);
        commands.push(`TOTAL: ${data.total.toFixed(2)}\n`);
    }

    // 6. Footer feed & Cut
    commands.push(CMD.INIT); // Reset formatting
    commands.push('\n\n\n\n'); // Feed lines
    commands.push(CMD.CUT);

    return Buffer.concat(commands.map(c => Buffer.from(c, 'binary'))); // Latin-1 usually binary safe
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

    // Handle USB (Windows only usually)
    if (printer.type === 'usb') {
        if (os.platform() !== 'win32') {
            return res.status(400).json({ error: 'USB printing currently supported on Windows only via this bridge.' });
        }
        if (!printer.name) {
            return res.status(400).json({ error: 'Missing printer name for USB printing' });
        }

        const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
        const scriptPath = path.join(__dirname, 'print_raw.ps1');

        try {
            fs.writeFileSync(tempFilePath, buffer);

            // Execute PowerShell script
            const psCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printer.name}" -FilePath "${tempFilePath}"`;

            console.log(`Printing to USB: ${printer.name}`);
            exec(psCommand, (error, stdout, stderr) => {
                // Cleanup
                try { fs.unlinkSync(tempFilePath); } catch (e) { }

                if (error) {
                    console.error('USB Print Error:', stderr || error.message);
                    return res.status(500).json({ error: 'Failed to print to USB: ' + (stderr || error.message) });
                }
                console.log('USB Print Success');
                res.json({ success: true });
            });
        } catch (err) {
            console.error('File Write Error:', err);
            return res.status(500).json({ error: 'Bridge internal error' });
        }
        return;
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
