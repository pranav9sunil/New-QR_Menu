import type { OrderItem, SessionWithOrders } from '@/types';

export const generateReceiptHtml = (
    session: SessionWithOrders,
    items: OrderItem[],
    title: string = 'Receipt', // Fallback, but we will override for Final Bill
    showPrices: boolean = true
) => {
    const pageWidth = '80mm';

    // Date Logic: Use session date (Order Paid/Saved Time)
    let dateObj = new Date();
    const getTimestampDate = (ts: any) => {
        if (!ts) return null;
        if (ts instanceof Date) return ts;
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
    };

    const sessionData = session as any; // Cast to access potential closedAt/createdAt
    const sessionDate = getTimestampDate(sessionData.closedAt) || getTimestampDate(sessionData.createdAt); // Use sessionData for createdAt too to be safe
    if (sessionDate) {
        dateObj = sessionDate;
    }

    const dateStr = dateObj.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    // Financial calculations (Tax Included 10%)
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const taxRate = 0.10; // 10%
    const baseTotal = total / (1 + taxRate);
    const taxAmount = total - baseTotal;

    // Group items by consolidation (same logic as LiveBillsPage)
    // to avoid printing same item multiple times if ordered separately but tracked together?
    // Actually for KOT (Kitchen Order Ticket), we might want to see individual order times, 
    // but the user's prompt implies "The Bill" (which usually means consolidated). 
    // However, for "Live Kitchen", it's usually incremental items. 
    // Let's print the specific list of items passed to this function.

    let itemsHtml = '';
    items.forEach(item => {
        const customizations = item.selectedCustomizations?.map(c => c.name).join(', ') || '';

        itemsHtml += `
            <div class="item">
                <div class="row">
                    <span class="qty">${item.quantity}x</span>
                    <span class="name">${item.name}</span>
                    ${showPrices ? `<span class="price">€${(item.price * item.quantity).toFixed(2)}</span>` : ''}
                </div>
                ${customizations ? `<div class="details">+ ${customizations}</div>` : ''}
                ${item.notes ? `<div class="note">Note: ${item.notes}</div>` : ''}
            </div>
        `;
    });

    const isFinalBill = title.toUpperCase().includes('BILL') || title.toUpperCase().includes('THALI') || title.toUpperCase().includes('TICKET');

    // Header Content
    const headerHtml = isFinalBill ? `
        <div class="title" style="font-size: 16px; font-weight: bold;">THALI : Authentic Indian Cuisine</div>
        <div class="address" style="font-size: 14px; margin-top: 5px;">Address: Plaza del Realejo,</div>
        <div class="address" style="font-size: 14px;">Local 1, 18009</div>
    ` : `<div class="title">${title}</div>`;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        @page { margin: 0; size: 80mm auto; }
        body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        .receipt-wrapper {
            font-family: 'Courier New', Courier, monospace;
            width: ${pageWidth};
            margin: 0 auto; /* Center the wrapper */
            box-sizing: border-box;
            padding: 20px 25px; /* Increased padding: Top/Bottom 20px, Left/Right 25px */
            font-size: 15px;
            line-height: 1.2;
            color: #000;
        }
        .header { text-align: center; margin-bottom: 20px; padding-top: 10px; }
        .meta { font-size: 13px; margin-top: 15px; text-align: left; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .item { margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; }
        .qty { width: 30px; font-weight: bold; }
        .name { flex: 1; font-weight: bold; }
        .price { width: 70px; text-align: right; }
        .details { margin-left: 30px; font-size: 13px; color: #333; }
        .note { margin-left: 30px; font-size: 13px; font-weight: bold; margin-top: 2px; }
        .financials { margin-top: 15px; font-size: 14px; }
        .total-row { font-size: 18px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="receipt-wrapper">
        <div class="header">
            ${headerHtml}
            <div class="meta">
                <div>Table: ${session.tableName}</div>
                <div>Date: ${dateStr}</div>
            </div>
        </div>
        
        <div class="divider"></div>
        
        ${itemsHtml}
        
        <div class="divider"></div>
        
        ${showPrices ? `
        <div class="financials" style="text-align: right;">
            <div class="row">
                <span>Base Total:</span>
                <span>€${baseTotal.toFixed(2)}</span>
            </div>
            <div class="row">
                <span>Tax (10%):</span>
                <span>€${taxAmount.toFixed(2)}</span>
            </div>
            <div class="row total-row" style="font-size: 18px;">
                <span>TOTAL:</span>
                <span>€${total.toFixed(2)}</span>
            </div>
        </div>
        ` : ''}

        <div style="text-align:center; margin-top:20px; font-size:14px;">
            GRACIAS POR SU VISITA
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
            window.close();
        }
    </script>
</body>
</html>
    `;
};

export const printReceipt = (session: SessionWithOrders, items: OrderItem[], title: string, showPrices: boolean = true) => {
    const html = generateReceiptHtml(session, items, title, showPrices);
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
};

export const categorizeItems = (items: OrderItem[]) => {
    const kitchenItems: OrderItem[] = [];
    const barItems: OrderItem[] = [];

    items.forEach(item => {
        // Simple logic: Drinks go to Bar, everything else to Kitchen
        // We rely on category name. If category is missing, check name?
        const category = item.category?.toLowerCase() || '';
        if (['drinks', 'beverages', 'cocktails', 'wines', 'beers', 'alcohol', 'soft drinks'].includes(category)) {
            barItems.push(item);
        } else {
            kitchenItems.push(item);
        }
    });

    return { kitchenItems, barItems };
};

export const printDirect = async (
    printerIp: string,
    printerPort: string,
    session: SessionWithOrders,
    items: OrderItem[],
    title: string,
    showPrices: boolean = true,
    options?: { type: 'network' | 'usb'; name?: string }
) => {
    // Financials
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const taxRate = 0.10;
    const baseTotal = total / (1 + taxRate);
    const taxAmount = total - baseTotal;

    // Date Logic
    const getTimestampDate = (ts: any) => {
        if (!ts) return null;
        if (ts instanceof Date) return ts;
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
    };
    const sessionData = session as any;
    const sessionDate = getTimestampDate(sessionData.closedAt) || getTimestampDate(session.createdAt) || new Date();
    const dateStr = sessionDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    const payload = {
        printer: {
            type: options?.type || 'network',
            ip: printerIp,
            port: parseInt(printerPort || '9100'),
            name: options?.name
        },
        data: {
            header: {
                title: "THALI : Authentic Indian Cuisine",
                address: ["Address: Plaza del Realejo,", "Local 1, 18009"],
                originalTitle: title // Keep original "KITCHEN TICKET" etc if needed for conditional logic
            },
            meta: {
                tableName: session.tableName,
                date: dateStr
            },
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                customizations: item.selectedCustomizations?.map(c => c.name).join(', '),
                notes: item.notes
            })),
            financials: showPrices ? {
                total: total,
                baseTotal: baseTotal,
                taxAmount: taxAmount,
                taxRate: taxRate
            } : undefined
        }
    };

    try {
        const response = await fetch('http://localhost:3001/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Bridge Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Direct Print Error:', error);
        throw error;
    }
};
