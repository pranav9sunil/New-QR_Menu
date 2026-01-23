import type { OrderItem, SessionWithOrders } from '@/types';

export const generateReceiptHtml = (
    session: SessionWithOrders,
    items: OrderItem[],
    title: string = 'Receipt',
    showPrices: boolean = true
) => {
    const pageWidth = '80mm';

    // Group items by consolidation (same logic as LiveBillsPage)
    // to avoid printing same item multiple times if ordered separately but tracked together?
    // Actually for KOT (Kitchen Order Ticket), we might want to see individual order times, 
    // but the user's prompt implies "The Bill" (which usually means consolidated). 
    // However, for "Live Kitchen", it's usually incremental items. 
    // Let's print the specific list of items passed to this function.

    const date = new Date().toLocaleString();

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

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        @page {
            margin: 0;
            size: 80mm auto;
        }
        body {
            font-family: 'Courier New', Courier, monospace;
            width: ${pageWidth};
            margin: 0 auto;
            padding: 10px;
            font-size: 14px;
            line-height: 1.2;
            color: #000;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .meta {
            font-size: 12px;
            margin-bottom: 5px;
        }
        .divider {
            border-top: 1px dashed #000;
            margin: 10px 0;
        }
        .item {
            margin-bottom: 10px;
        }
        .row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .qty {
            width: 30px;
            font-weight: bold;
        }
        .name {
            flex: 1;
            font-weight: bold;
        }
        .price {
            width: 60px;
            text-align: right;
        }
        .details {
            margin-left: 30px;
            font-size: 12px;
            color: #333;
        }
        .note {
            margin-left: 30px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 2px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${title}</div>
        <div class="meta">Table: ${session.tableName}</div>
        <div class="meta">${date}</div>
    </div>
    
    <div class="divider"></div>
    
    ${itemsHtml}
    
    <div class="divider"></div>
    
    ${showPrices ? `
    <div class="row">
        <span style="font-weight:bold">Total:</span>
        <span class="price" style="font-weight:bold">€${items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
    </div>
    ` : ''}

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
    showPrices: boolean = true
) => {
    const payload = {
        ip: printerIp,
        port: parseInt(printerPort || '9100'),
        data: {
            title,
            tableName: session.tableName,
            showPrices,
            total: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                customizations: item.selectedCustomizations?.map(c => c.name).join(', '),
                notes: item.notes
            }))
        }
    };

    try {
        const response = await fetch('http://localhost:3001/print', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Bridge Error: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Direct Print Error:', error);
        throw error;
    }
};
