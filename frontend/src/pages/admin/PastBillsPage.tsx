import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import type { TableSession, Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Receipt, Calendar, Printer } from 'lucide-react';


export default function PastBillsPage() {
    const { restaurantId } = useAuth();
    const [sessions, setSessions] = useState<TableSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'day' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedSession, setSelectedSession] = useState<{ session: TableSession, orders: Order[] } | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [printers, setPrinters] = useState<any[]>([]);

    useEffect(() => {
        if (restaurantId) {
            loadPastSessions();
            loadPrinters();
        }
    }, [restaurantId, filterType, selectedDate, selectedMonth]);

    const loadPrinters = async () => {
        if (!restaurantId) return;
        try {
            const printersRef = collection(db, 'printers');
            const q = query(printersRef, where('restaurantId', '==', restaurantId));
            const snapshot = await getDocs(q);
            const loadedPrinters: any[] = [];
            snapshot.forEach(doc => loadedPrinters.push({ id: doc.id, ...doc.data() }));
            setPrinters(loadedPrinters);
        } catch (error) {
            console.error('Error loading printers:', error);
        }
    };

    const loadPastSessions = async () => {
        if (!restaurantId) return;
        setLoading(true);
        const sessionsRef = collection(db, 'sessions');

        // Use local browser time range for simplicity first, then we can refine if strictly needed.
        // Actually, let's use a simpler approach that covers "entire day +/- margin" to ensure we get data, 
        // then filter exact CET times in client. This is safer against Firestore index issues.

        const targetDate = new Date(selectedDate);
        const queryStart = new Date(targetDate);
        queryStart.setDate(queryStart.getDate() - 1); // Buffer
        const queryEnd = new Date(targetDate);
        queryEnd.setDate(queryEnd.getDate() + 2); // Buffer

        try {
            // Strategy: Fetch ALL closed sessions for this restaurant (within reasonable bounds) 
            // and filter in memory. This avoids complex composite indexes with timezones.
            // If dataset is huge, this needs optimization, but for now it ensures ACCURACY.

            // Try fetch by status 'closed' only first (most reliable)
            const q = query(
                sessionsRef,
                where('restaurantId', '==', restaurantId),
                where('status', '==', 'closed'),
                orderBy('closedAt', 'desc') // Ensure we have index for this
            );

            const snapshot = await getDocs(q);
            const loadedSessions: TableSession[] = [];

            // CET Offset helper
            const isWithinCETRange = (date: Date) => {
                // Convert UTC date to CET string to check 'YYYY-MM-DD'
                // CET is GMT+1
                const cetDate = new Date(date.getTime() + (60 * 60 * 1000));
                const dateStr = cetDate.toISOString().split('T')[0];
                return dateStr === selectedDate;
            };

            const isWithinCETMonth = (date: Date) => {
                const cetDate = new Date(date.getTime() + (60 * 60 * 1000));
                const monthStr = cetDate.toISOString().slice(0, 7);
                return monthStr === selectedMonth;
            };

            snapshot.forEach((doc) => {
                const data = doc.data() as TableSession;
                // Use closedAt preferably, fallback to createdAt
                const timestamp = data.closedAt || data.createdAt;
                const dateObj = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

                if (filterType === 'day') {
                    if (isWithinCETRange(dateObj)) {
                        loadedSessions.push({ ...data, id: doc.id });
                    }
                } else {
                    if (isWithinCETMonth(dateObj)) {
                        loadedSessions.push({ ...data, id: doc.id });
                    }
                }
            });

            setSessions(loadedSessions);
        } catch (error) {
            console.error('Error loading past sessions:', error);
            // Fallback for missing index on closedAt
            try {
                const qFallback = query(
                    sessionsRef,
                    where('restaurantId', '==', restaurantId),
                    where('status', '==', 'closed')
                );
                const snapshot = await getDocs(qFallback);
                const loadedSessions: TableSession[] = [];

                // Same filter logic
                const isWithinCETRange = (date: Date) => {
                    const cetDate = new Date(date.getTime() + (60 * 60 * 1000));
                    const dateStr = cetDate.toISOString().split('T')[0];
                    return dateStr === selectedDate;
                };

                snapshot.forEach((doc) => {
                    const data = doc.data() as TableSession;
                    const timestamp = data.closedAt || data.createdAt;
                    const dateObj = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

                    if (isWithinCETRange(dateObj)) {
                        loadedSessions.push({ ...data, id: doc.id });
                    }
                });

                // Manual Sort
                loadedSessions.sort((a, b) => {
                    const getT = (s: TableSession) => {
                        const t = s.closedAt || s.createdAt;
                        return t instanceof Timestamp ? t.toMillis() : new Date(t).getTime();
                    }
                    return getT(b) - getT(a);
                });

                setSessions(loadedSessions);
            } catch (e) { console.error("Fatal fallback error", e); }
        } finally {
            setLoading(false);
        }
    };

    const viewBillDetails = async (session: TableSession) => {
        setDetailsLoading(true);
        setDetailsOpen(true);
        try {
            const ordersRef = collection(db, 'orders');
            const q = query(
                ordersRef,
                where('sessionId', '==', session.id)
            );
            const snapshot = await getDocs(q);
            const orders: Order[] = [];
            snapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() } as Order);
            });

            // Sort orders
            orders.sort((a, b) => {
                const getDate = (date: any) => {
                    if (date instanceof Date) return date;
                    if (date && typeof date.toDate === 'function') return date.toDate();
                    if (date && date.seconds) return new Date(date.seconds * 1000);
                    return new Date(date);
                };
                return getDate(b.createdAt).getTime() - getDate(a.createdAt).getTime();
            });

            setSelectedSession({ session, orders });
        } catch (error) {
            console.error('Error loading bill details:', error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);

        // Force display in CET/CEST (Restaurant Timezone)
        return new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Madrid',
            hour12: false
        }).format(d);
    };

    const calculateBillSummary = (orders: Order[], session: TableSession) => {
        const summary = {
            items: [] as { name: string; quantity: number; price: number; total: number }[],
            subtotal: 0,
            tax: 0,
            discount: 0,
            tip: session.tipAmount || 0,
            total: 0
        };

        const itemMap = new Map<string, { name: string; quantity: number; price: number; total: number }>();

        orders.forEach(order => {
            summary.subtotal += order.subtotal;
            summary.tax += order.tax;
            summary.discount += (order.discount || 0);

            order.items.forEach(item => {
                // Create a unique key for aggregation
                const key = `${item.name}-${item.price}`;

                if (itemMap.has(key)) {
                    const existing = itemMap.get(key)!;
                    existing.quantity += item.quantity;
                    existing.total += (item.price * item.quantity);
                } else {
                    itemMap.set(key, {
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        total: (item.price * item.quantity)
                    });
                }
            });
        });

        summary.items = Array.from(itemMap.values());
        // Calculate final total based on components
        summary.total = summary.subtotal + summary.tax + summary.tip - summary.discount;

        return summary;
    };

    const handlePrintBill = async () => {
        if (!selectedSession || selectedSession.orders.length === 0) return;

        const summary = calculateBillSummary(selectedSession.orders, selectedSession.session);
        const mappedItems: any[] = summary.items.map((item, index) => ({
            id: `past-bill-item-${index}`,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            selectedCustomizations: [],
            notes: '',
            status: 'served'
        }));

        // Construct compatible session object
        const fullSession = {
            ...selectedSession.session,
            sessionId: selectedSession.session.id, // Ensure ID is mapped if needed
            orders: selectedSession.orders
        } as any;

        // Find standard receipt printer (default to first one found)
        const receiptPrinter = printers.find(p => p.type === 'receipt');

        if (receiptPrinter) {
            const { printDirect } = await import('@/utils/receiptGenerator');
            try {
                await printDirect(
                    receiptPrinter.ipAddress, // Corrected from ip to ipAddress based on LiveBillsPage usage
                    receiptPrinter.port || '9100',
                    fullSession,
                    mappedItems,
                    'Final Bill',
                    true,
                    { type: receiptPrinter.interfaceType || 'network', name: receiptPrinter.name }
                );
                return; // Success
            } catch (error) {
                console.error("Bridge print failed, falling back to browser print", error);
            }
        }

        // Fallback
        import('@/utils/receiptGenerator').then(({ printReceipt }) => {
            printReceipt(fullSession, mappedItems, 'Final Bill');
        });
    };

    const handleDownloadPDF = async () => {
        if (!selectedSession || selectedSession.orders.length === 0) return;

        const summary = calculateBillSummary(selectedSession.orders, selectedSession.session);
        const mappedItems: any[] = summary.items.map((item, index) => ({
            id: `past-bill-item-${index}`,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            selectedCustomizations: [],
            notes: '',
            status: 'served'
        }));

        const fullSession = {
            ...selectedSession.session,
            sessionId: selectedSession.session.id,
            orders: selectedSession.orders
        } as any;

        const { generateReceiptHtml } = await import('@/utils/receiptGenerator');
        const htmlContent = generateReceiptHtml(fullSession, mappedItems, 'Final Bill', true);

        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, 200]
        });

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        tempDiv.style.width = '80mm';
        tempDiv.style.fontSize = '12px';
        tempDiv.style.fontFamily = 'monospace';
        document.body.appendChild(tempDiv);

        try {
            await doc.html(tempDiv, {
                callback: function (doc) {
                    doc.save(`Bill-${selectedSession.session.tableName}-${selectedSession.session.code}.pdf`);
                    document.body.removeChild(tempDiv);
                },
                x: 0,
                y: 0,
                html2canvas: { scale: 0.25 },
                autoPaging: true,
                width: 80,
                windowWidth: 350
            });
        } catch (error) {
            console.error("Error generating PDF:", error);
            document.body.removeChild(tempDiv);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold">Past Bills</h1>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                    <div className="flex rounded-md bg-muted p-1">
                        <Button
                            variant={filterType === 'day' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilterType('day')}
                            className="h-8"
                        >
                            Daily
                        </Button>
                        <Button
                            variant={filterType === 'month' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setFilterType('month')}
                            className="h-8"
                        >
                            Monthly
                        </Button>
                    </div>

                    {filterType === 'day' ? (
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-40 h-9"
                        />
                    ) : (
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-40 h-9"
                        />
                    )}
                </div>
                <Button variant="outline" onClick={loadPastSessions}>
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>History</CardTitle>
                    <CardDescription>View closed sessions and bills</CardDescription>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No past bills found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {formatDate(session.createdAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{session.tableName}</TableCell>
                                        <TableCell>
                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                                {session.code}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => viewBillDetails(session)}
                                            >
                                                <Receipt className="h-4 w-4 mr-2" />
                                                View Bill
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Bill Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Final Bill
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSession?.session.tableName} • {formatDate(selectedSession?.session.createdAt)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4">
                        {detailsLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : !selectedSession || selectedSession.orders.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <p>No orders found for this session.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    const summary = calculateBillSummary(selectedSession.orders, selectedSession.session);
                                    return (
                                        <>
                                            {/* Consolidated Items List */}
                                            <div className="space-y-3">
                                                {summary.items.map((item, index) => (
                                                    <div key={index} className="flex justify-between text-sm">
                                                        <div className="flex gap-2">
                                                            <span className="font-semibold text-gray-700">{item.quantity}x</span>
                                                            <span className="text-gray-900">{item.name}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-900">€{item.total.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border-t my-4"></div>

                                            {/* Financial Summary */}
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between text-gray-600">
                                                    <span>Subtotal</span>
                                                    <span>€{summary.subtotal.toFixed(2)}</span>
                                                </div>
                                                {summary.tax > 0 && (
                                                    <div className="flex justify-between text-gray-600">
                                                        <span>Tax</span>
                                                        <span>€{summary.tax.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {summary.discount > 0 && (
                                                    <div className="flex justify-between text-green-600">
                                                        <span>Discount</span>
                                                        <span>-€{summary.discount.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {summary.tip > 0 && (
                                                    <div className="flex justify-between text-blue-600">
                                                        <span>Tip</span>
                                                        <span>€{summary.tip.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Total Footer inside Dialog */}
                                            <div className="space-y-4 pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 mt-auto">
                                                <div className="flex justify-between text-xl font-bold text-primary">
                                                    <span>Total</span>
                                                    <span>€{summary.total.toFixed(2)}</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <Button onClick={handlePrintBill} className="w-full flex gap-2">
                                                        <Printer className="w-4 h-4" />
                                                        Print
                                                    </Button>
                                                    <Button onClick={handleDownloadPDF} variant="outline" className="w-full flex gap-2">
                                                        Download PDF
                                                    </Button>
                                                </div>
                                                <Button onClick={() => setDetailsOpen(false)} variant="ghost" className="w-full">Close</Button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
