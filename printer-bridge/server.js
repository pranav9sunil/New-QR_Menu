const express = require('express');
const cors = require('cors');
const net = require('net');
const bodyParser = require('body-parser');

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
    const { ip, port, data } = req.body;

    if (!ip || !data) {
        return res.status(400).json({ error: 'Missing IP or data' });
    }

    const targetPort = port || 9100;
    const client = new net.Socket();

    console.log(`Connecting to printer at ${ip}:${targetPort}...`);

    client.connect(targetPort, ip, () => {
        console.log('Connected. Sending data...');
        const buffer = buildReceiptBuffer(data);
        client.write(buffer, () => {
            console.log('Data sent. Closing connection.');
            client.end();
            res.json({ success: true });
        });
    });

    client.on('error', (err) => {
        console.error('Printer connection error:', err);
        res.status(500).json({ error: 'Failed to connect to printer: ' + err.message });
    });

    client.on('timeout', () => {
        console.error('Printer connection timeout');
        client.destroy();
        res.status(500).json({ error: 'Printer connection timeout' });
    });
});

app.listen(PORT, () => {
    console.log(`Printer Bridge Server running on http://localhost:${PORT}`);
});
