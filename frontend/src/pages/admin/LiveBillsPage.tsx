import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import type { Order, MenuItem, OrderItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Minus, Trash2, Printer, Search, Percent, DollarSign } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface SessionWithOrders {
    sessionId: string;
    tableName: string;
    tableId: string;
    orders: Order[];
    totalAmount: number;
}

export default function LiveBillsPage() {
    const { restaurantId } = useAuth();
    const [sessions, setSessions] = useState<SessionWithOrders[]>([]);
    const [selectedSession, setSelectedSession] = useState<SessionWithOrders | null>(null);
    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);

    // Add Item Modal
    const [addItemModalOpen, setAddItemModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
    const [quantity, setQuantity] = useState(1);

    // Discount Modal
    const [discountModalOpen, setDiscountModalOpen] = useState(false);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState<number | string>('');

    // Manual Order Modal
    const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);
    const [availableTables, setAvailableTables] = useState<any[]>([]);
    const [selectedTable, setSelectedTable] = useState<any | null>(null);
    const [manualOrderItems, setManualOrderItems] = useState<OrderItem[]>([]);

    // Print Modal
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedPrinter, setSelectedPrinter] = useState<string>('');

    useEffect(() => {
        if (restaurantId) {
            loadData();
            const unsubscribe = subscribeToOrders();
            return () => unsubscribe();
        }
    }, [restaurantId]);

    // Sync selectedSession when sessions update
    useEffect(() => {
        if (selectedSession) {
            const updatedSession = sessions.find(s => s.sessionId === selectedSession.sessionId);
            if (updatedSession) {
                setSelectedSession(updatedSession);
            } else {
                // Session no longer exists (e.g., was completed)
                setSelectedSession(null);
            }
        }
    }, [sessions]);

    const loadData = async () => {
        if (!restaurantId) return;

        try {
            // Load menu items
            const menuRef = collection(db, 'menu_items');
            const menuQuery = query(menuRef, where('restaurantId', '==', restaurantId));
            const menuSnapshot = await getDocs(menuQuery);
            const items: MenuItem[] = [];
            menuSnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MenuItem);
            });
            setMenuItems(items);

            // Load printers
            const printersRef = collection(db, 'printers');
            const printersQuery = query(printersRef, where('restaurantId', '==', restaurantId));
            const printersSnapshot = await getDocs(printersQuery);
            const printersList: any[] = [];
            printersSnapshot.forEach((doc) => {
                printersList.push({ id: doc.id, ...doc.data() });
            });
            setPrinters(printersList);

            // Load ALL tables (occupied and free)
            const tablesRef = collection(db, 'tables');
            const tablesQuery = query(tablesRef, where('restaurantId', '==', restaurantId));
            const tablesSnapshot = await getDocs(tablesQuery);
            const tablesList: any[] = [];
            tablesSnapshot.forEach((doc) => {
                tablesList.push({ id: doc.id, ...doc.data() });
            });
            setAvailableTables(tablesList);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToOrders = () => {
        if (!restaurantId) return () => { };

        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('restaurantId', '==', restaurantId)
        );

        return onSnapshot(q, async (snapshot) => {
            const orders: Order[] = [];
            snapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() } as Order);
            });

            // Get active sessions
            const sessionsRef = collection(db, 'sessions');
            const sessionsQuery = query(
                sessionsRef,
                where('restaurantId', '==', restaurantId),
                where('status', '==', 'active')
            );
            const sessionsSnapshot = await getDocs(sessionsQuery);
            const activeSessionIds = new Set<string>();
            const sessionTableMap = new Map<string, { tableName: string, tableId: string }>();

            sessionsSnapshot.forEach((doc) => {
                const sessionData = doc.data();
                activeSessionIds.add(doc.id);
                sessionTableMap.set(doc.id, {
                    tableName: sessionData.tableName,
                    tableId: sessionData.tableId
                });
            });

            // Filter orders to only include those from active sessions
            const activeOrders = orders.filter(order =>
                order.sessionId && activeSessionIds.has(order.sessionId)
            );

            // Group by session
            const sessionMap = new Map<string, SessionWithOrders>();

            for (const order of activeOrders) {
                const sessionId = order.sessionId!;
                if (!sessionMap.has(sessionId)) {
                    const sessionInfo = sessionTableMap.get(sessionId);
                    sessionMap.set(sessionId, {
                        sessionId,
                        tableName: sessionInfo?.tableName || order.tableName,
                        tableId: sessionInfo?.tableId || order.tableId,
                        orders: [],
                        totalAmount: 0,
                    });
                }
                const session = sessionMap.get(sessionId)!;
                session.orders.push(order);
                session.totalAmount += order.total;
            }

            setSessions(Array.from(sessionMap.values()));
        });
    };

    const handleAddItemToOrder = async () => {
        if (!selectedSession || !selectedMenuItem) return;

        try {
            // Find the most recent order for this session
            const latestOrder = selectedSession.orders.sort((a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime()
            )[0];

            const newItem: OrderItem = {
                menuItemId: selectedMenuItem.id,
                name: selectedMenuItem.name,
                price: selectedMenuItem.price,
                quantity,
                category: selectedMenuItem.category,
            }

            const updatedItems = [...latestOrder.items, newItem];
            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08; // Assuming 8% tax
            const discount = latestOrder.discount || 0;
            const discountAmount = latestOrder.discountType === 'percentage'
                ? (subtotal + tax) * (discount / 100)
                : discount;
            const total = subtotal + tax - discountAmount;

            await updateDoc(doc(db, 'orders', latestOrder.id), {
                items: updatedItems,
                subtotal,
                tax,
                total,
            });

            setAddItemModalOpen(false);
            setSelectedMenuItem(null);
            setQuantity(1);
            setSearchQuery('');
        } catch (error) {
            console.error('Error adding item:', error);
        }
    };

    // Handler to update quantity for a specific item in an order
    const handleUpdateConsolidatedQuantity = async (orderId: string, itemName: string, itemPrice: number, customizations: string, delta: number) => {
        if (!selectedSession) return;

        // Find the order and item
        const order = selectedSession.orders.find(o => o.id === orderId);
        if (!order) return;

        const itemIndex = order.items.findIndex(item => {
            const itemCustomizations = item.selectedCustomizations?.map(c => c.name).sort().join(',') || '';
            return item.name === itemName && item.price === itemPrice && itemCustomizations === customizations;
        });

        if (itemIndex === -1) return;

        const newQuantity = order.items[itemIndex].quantity + delta;
        if (newQuantity < 1) return;

        try {
            const updatedItems = [...order.items];
            updatedItems[itemIndex].quantity = newQuantity;

            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08;
            const discount = order.discount || 0;
            const discountAmount = order.discountType === 'percentage'
                ? (subtotal + tax) * (discount / 100)
                : discount;
            const total = subtotal + tax - discountAmount;

            await updateDoc(doc(db, 'orders', orderId), {
                items: updatedItems,
                subtotal,
                tax,
                total,
            });
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    };

    // Handler to remove an item from an order
    const handleRemoveConsolidatedItem = async (orderId: string, itemName: string, itemPrice: number, customizations: string) => {
        if (!selectedSession) return;
        if (!confirm('Remove this item from the order?')) return;

        const order = selectedSession.orders.find(o => o.id === orderId);
        if (!order) return;

        const itemIndex = order.items.findIndex(item => {
            const itemCustomizations = item.selectedCustomizations?.map(c => c.name).sort().join(',') || '';
            return item.name === itemName && item.price === itemPrice && itemCustomizations === customizations;
        });

        if (itemIndex === -1) return;

        try {
            const updatedItems = order.items.filter((_, index) => index !== itemIndex);

            if (updatedItems.length === 0) {
                await deleteDoc(doc(db, 'orders', orderId));
                return;
            }

            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08;
            const discount = order.discount || 0;
            const discountAmount = order.discountType === 'percentage'
                ? (subtotal + tax) * (discount / 100)
                : discount;
            const total = subtotal + tax - discountAmount;

            await updateDoc(doc(db, 'orders', orderId), {
                items: updatedItems,
                subtotal,
                tax,
                total,
            });
        } catch (error) {
            console.error('Error removing item:', error);
        }
    };

    const handleApplyDiscount = async () => {
        if (!selectedSession) return;

        const val = typeof discountValue === 'string' ? parseFloat(discountValue) : discountValue;
        if (isNaN(val) || val < 0) {
            alert('Please enter a valid discount value');
            return;
        }

        try {
            for (const order of selectedSession.orders) {
                const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const tax = subtotal * 0.08;
                const totalBeforeDiscount = subtotal + tax;

                let discountAmount = 0;
                if (discountType === 'percentage') {
                    if (val > 100) {
                        alert('Percentage discount cannot exceed 100%');
                        return;
                    }
                    discountAmount = totalBeforeDiscount * (val / 100);
                } else {
                    discountAmount = val;
                }

                if (discountAmount > totalBeforeDiscount) {
                    alert('Discount cannot exceed total order value');
                    return;
                }

                const total = totalBeforeDiscount - discountAmount;

                await updateDoc(doc(db, 'orders', order.id), {
                    discount: val,
                    discountType,
                    total,
                });
            }

            setDiscountModalOpen(false);
            setDiscountValue('');
        } catch (error) {
            console.error('Error applying discount:', error);
        }
    };

    const handleCreateManualOrder = async () => {
        if (!selectedTable || !restaurantId || manualOrderItems.length === 0) return;

        try {
            // Check if table already has an active session
            const sessionsRef = collection(db, 'sessions');
            const sessionQuery = query(
                sessionsRef,
                where('restaurantId', '==', restaurantId),
                where('tableId', '==', selectedTable.id),
                where('status', '==', 'active')
            );
            const sessionSnapshot = await getDocs(sessionQuery);

            let sessionId: string;

            if (!sessionSnapshot.empty) {
                // Table has active session - use existing session
                sessionId = sessionSnapshot.docs[0].id;
            } else {
                // Table is free - create new session with code
                const code = Math.floor(Math.random() * 90 + 10).toString(); // 2 digit code
                const newSessionRef = await addDoc(collection(db, 'sessions'), {
                    restaurantId,
                    tableId: selectedTable.id,
                    tableName: selectedTable.name,
                    code,
                    status: 'active',
                    createdAt: serverTimestamp(),
                });
                sessionId = newSessionRef.id;

                // Mark table as occupied
                await updateDoc(doc(db, 'tables', selectedTable.id), {
                    isOccupied: true,
                });
            }

            // Create order (same way as customer orders)
            const subtotal = manualOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = subtotal * 0.08;
            const total = subtotal + tax;

            await addDoc(collection(db, 'orders'), {
                restaurantId,
                tableId: selectedTable.id,
                tableName: selectedTable.name,
                sessionId: sessionId,
                items: manualOrderItems,
                status: 'pending',
                subtotal,
                tax,
                total,
                manualOrder: true,
                createdAt: serverTimestamp(),
            });

            setManualOrderModalOpen(false);
            setSelectedTable(null);
            setManualOrderItems([]);
            loadData(); // Refresh tables list
        } catch (error) {
            console.error('Error creating manual order:', error);
        }
    };

    // Print bill WITHOUT closing the order (intermediate print)
    const handlePrintOnly = () => {
        if (!selectedSession) return;

        try {
            // Generate PDF
            const pdf = new jsPDF();
            let yPos = 20;

            pdf.setFontSize(20);
            pdf.text('Bill', 105, yPos, { align: 'center' });
            yPos += 15;

            pdf.setFontSize(12);
            pdf.text(`Table: ${selectedSession.tableName}`, 20, yPos);
            yPos += 10;
            pdf.text(`Date: ${new Date().toLocaleString()}`, 20, yPos);
            yPos += 15;

            pdf.setFontSize(10);
            pdf.text('Item', 20, yPos);
            pdf.text('Qty', 120, yPos);
            pdf.text('Price', 150, yPos);
            pdf.text('Total', 180, yPos);
            yPos += 5;
            pdf.line(20, yPos, 190, yPos);
            yPos += 10;

            for (const order of selectedSession.orders) {
                for (const item of order.items) {
                    pdf.text(item.name, 20, yPos);
                    pdf.text(item.quantity.toString(), 120, yPos);
                    pdf.text(`€${item.price.toFixed(2)}`, 150, yPos);
                    pdf.text(`€${(item.price * item.quantity).toFixed(2)}`, 180, yPos);
                    yPos += 7;
                }
            }

            yPos += 5;
            pdf.line(20, yPos, 190, yPos);
            yPos += 10;

            const firstOrder = selectedSession.orders[0];
            const subtotal = selectedSession.orders.reduce((sum, order) => sum + order.subtotal, 0);
            const tax = selectedSession.orders.reduce((sum, order) => sum + order.tax, 0);
            const discount = firstOrder.discount || 0;
            const discountAmount = firstOrder.discountType === 'percentage'
                ? (subtotal + tax) * (discount / 100)
                : discount;

            pdf.text('Subtotal:', 140, yPos);
            pdf.text(`€${subtotal.toFixed(2)}`, 180, yPos);
            yPos += 7;
            pdf.text('Tax (8%):', 140, yPos);
            pdf.text(`€${tax.toFixed(2)}`, 180, yPos);
            yPos += 7;

            if (discount > 0) {
                pdf.text(`Discount:`, 120, yPos);
                pdf.text(`-€${discountAmount.toFixed(2)}`, 180, yPos);
                yPos += 7;
            }

            yPos += 5;
            pdf.setFontSize(14);
            pdf.text(`Total:`, 120, yPos);
            pdf.text(`€${selectedSession.totalAmount.toFixed(2)}`, 180, yPos);

            // Download PDF (no order status changes)
            pdf.save(`bill-${selectedSession.tableName}-${Date.now()}.pdf`);

        } catch (error) {
            console.error('Error printing bill:', error);
        }
    };

    // Print FINAL bill and mark order as completed
    const handlePrintBill = async () => {
        if (!selectedSession) return;

        try {
            // Generate PDF
            const pdf = new jsPDF();
            let yPos = 20;

            pdf.setFontSize(20);
            pdf.text('FINAL BILL', 105, yPos, { align: 'center' });
            yPos += 15;

            pdf.setFontSize(12);
            pdf.text(`Table: ${selectedSession.tableName}`, 20, yPos);
            yPos += 10;
            pdf.text(`Date: ${new Date().toLocaleString()}`, 20, yPos);
            yPos += 15;

            pdf.setFontSize(10);
            pdf.text('Item', 20, yPos);
            pdf.text('Qty', 120, yPos);
            pdf.text('Price', 150, yPos);
            pdf.text('Total', 180, yPos);
            yPos += 5;
            pdf.line(20, yPos, 190, yPos);
            yPos += 10;

            for (const order of selectedSession.orders) {
                for (const item of order.items) {
                    pdf.text(item.name, 20, yPos);
                    pdf.text(item.quantity.toString(), 120, yPos);
                    pdf.text(`€${item.price.toFixed(2)}`, 150, yPos);
                    pdf.text(`€${(item.price * item.quantity).toFixed(2)}`, 180, yPos);
                    yPos += 7;
                }
            }

            yPos += 5;
            pdf.line(20, yPos, 190, yPos);
            yPos += 10;

            const firstOrder = selectedSession.orders[0];
            const subtotal = selectedSession.orders.reduce((sum, order) => sum + order.subtotal, 0);
            const tax = selectedSession.orders.reduce((sum, order) => sum + order.tax, 0);
            const discount = firstOrder.discount || 0;
            const discountAmount = firstOrder.discountType === 'percentage'
                ? (subtotal + tax) * (discount / 100)
                : discount;

            pdf.text('Subtotal:', 140, yPos);
            pdf.text(`€${subtotal.toFixed(2)}`, 180, yPos);
            yPos += 7;
            pdf.text(`€${tax.toFixed(2)}`, 180, yPos);
            yPos += 7;

            if (discount > 0) {
                pdf.text(`Discount:`, 120, yPos);
                pdf.text(`-€${discountAmount.toFixed(2)}`, 180, yPos);
                yPos += 7;
            }

            yPos += 5;
            pdf.setFontSize(14);
            pdf.text(`Total:`, 120, yPos);
            pdf.text(`€${selectedSession.totalAmount.toFixed(2)}`, 180, yPos);

            // Download PDF
            pdf.save(`bill-${selectedSession.tableName}-${Date.now()}.pdf`);

            // Mark orders as completed
            for (const order of selectedSession.orders) {
                await updateDoc(doc(db, 'orders', order.id), {
                    status: 'completed',
                });
            }

            // Update session status
            if (selectedSession.sessionId) {
                await updateDoc(doc(db, 'sessions', selectedSession.sessionId), {
                    status: 'closed',
                });
            }

            // Mark table as available
            await updateDoc(doc(db, 'tables', selectedSession.tableId), {
                isOccupied: false,
            });

            setPrintModalOpen(false);
            setSelectedSession(null);
        } catch (error) {
            console.error('Error printing bill:', error);
        }
    };

    const filteredMenuItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800">Live Bills</h1>
            </div>

            {
                sessions.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <p>No active orders. Create a manual order to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Table List */}
                        <div className="lg:col-span-1 space-y-4">
                            <h2 className="text-xl font-semibold text-gray-800">Active Tables</h2>
                            {sessions.map((session) => (
                                <Card
                                    key={session.sessionId}
                                    className={`cursor-pointer transition-all border-orange-100 ${selectedSession?.sessionId === session.sessionId
                                        ? 'ring-2 ring-orange-500 bg-orange-50'
                                        : 'hover:shadow-md'
                                        }`}
                                    onClick={() => setSelectedSession(session)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg">{session.tableName}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {session.orders.length} order(s)
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-orange-600">
                                                    €{session.totalAmount.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Right: Order Details */}
                        <div className="lg:col-span-2">
                            {selectedSession ? (
                                <Card className="border-orange-100">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-2xl">{selectedSession.tableName}</CardTitle>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Session ID: {selectedSession.sessionId}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setAddItemModalOpen(true)}
                                                    className="border-orange-200 hover:bg-orange-50"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add Item
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        // Pre-fill discount from the first order if available
                                                        const firstOrder = selectedSession.orders[0];
                                                        if (firstOrder && firstOrder.discount) {
                                                            setDiscountValue(firstOrder.discount);
                                                            setDiscountType(firstOrder.discountType || 'percentage');
                                                        } else {
                                                            setDiscountValue('');
                                                            setDiscountType('percentage');
                                                        }
                                                        setDiscountModalOpen(true);
                                                    }}
                                                    className="border-orange-200 hover:bg-orange-50"
                                                >
                                                    <Percent className="h-4 w-4 mr-2" />
                                                    Discount
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handlePrintOnly}
                                                    className="border-orange-200 hover:bg-orange-50"
                                                >
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Print
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => setPrintModalOpen(true)}
                                                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                                                >
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Bill
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Consolidated Items View */}
                                        {(() => {
                                            // Consolidate all items from all orders
                                            interface ConsolidatedItem {
                                                name: string;
                                                price: number;
                                                quantity: number;
                                                orderId: string;
                                                originalItemIndex: number;
                                                customizations?: string;
                                            }
                                            const consolidatedItems: ConsolidatedItem[] = [];

                                            selectedSession.orders.forEach(order => {
                                                order.items.forEach((item, itemIndex) => {
                                                    const customizationsKey = item.selectedCustomizations?.map(c => c.name).sort().join(',') || '';
                                                    const existingIndex = consolidatedItems.findIndex(
                                                        ci => ci.name === item.name && ci.price === item.price && ci.customizations === customizationsKey
                                                    );

                                                    if (existingIndex >= 0) {
                                                        consolidatedItems[existingIndex].quantity += item.quantity;
                                                    } else {
                                                        consolidatedItems.push({
                                                            name: item.name,
                                                            price: item.price,
                                                            quantity: item.quantity,
                                                            orderId: order.id,
                                                            originalItemIndex: itemIndex,
                                                            customizations: customizationsKey
                                                        });
                                                    }
                                                });
                                            });

                                            // Calculate totals
                                            const subtotal = consolidatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                            const tax = subtotal * 0.08;
                                            const firstOrder = selectedSession.orders[0];
                                            const discount = firstOrder?.discount || 0;
                                            const discountAmount = firstOrder?.discountType === 'percentage'
                                                ? (subtotal + tax) * (discount / 100)
                                                : discount;
                                            const total = subtotal + tax - discountAmount;

                                            return (
                                                <>
                                                    <div className="space-y-2">
                                                        <h3 className="font-semibold text-gray-700">All Items</h3>
                                                        {consolidatedItems.map((item, index) => (
                                                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                                <div className="flex-1">
                                                                    <p className="font-medium">{item.name}</p>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        €{item.price.toFixed(2)} each
                                                                        {item.customizations && (
                                                                            <span className="ml-1">(+{item.customizations})</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => handleUpdateConsolidatedQuantity(item.orderId, item.name, item.price, item.customizations || '', -1)}
                                                                            disabled={item.quantity <= 1}
                                                                        >
                                                                            <Minus className="h-4 w-4" />
                                                                        </Button>
                                                                        <span className="w-8 text-center font-semibold">
                                                                            {item.quantity}
                                                                        </span>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-8 w-8"
                                                                            onClick={() => handleUpdateConsolidatedQuantity(item.orderId, item.name, item.price, item.customizations || '', 1)}
                                                                        >
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                    <p className="font-semibold text-orange-600 w-20 text-right">
                                                                        €{(item.price * item.quantity).toFixed(2)}
                                                                    </p>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                        onClick={() => handleRemoveConsolidatedItem(item.orderId, item.name, item.price, item.customizations || '')}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="border-t pt-3 space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Subtotal:</span>
                                                            <span>€{subtotal.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span>Tax (8%):</span>
                                                            <span>€{tax.toFixed(2)}</span>
                                                        </div>
                                                        {discount > 0 && (
                                                            <div className="flex justify-between text-sm text-green-600">
                                                                <span>
                                                                    Discount
                                                                    {firstOrder?.discountType === 'percentage' && ` (${discount}%)`}:
                                                                </span>
                                                                <span>-€{discountAmount.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                                            <span>Total:</span>
                                                            <span className="text-orange-600">€{total.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="border-orange-100">
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        <p>Select a table to view order details</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Add Item Modal */}
            <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
                <DialogContent className="max-w-2xl bg-white">
                    <DialogHeader>
                        <DialogTitle>Add Item to Order</DialogTitle>
                        <DialogDescription>Search and select an item from the menu</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                placeholder="Search menu items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {filteredMenuItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedMenuItem?.id === item.id
                                        ? 'border-orange-500 bg-orange-50'
                                        : 'hover:bg-gray-50'
                                        }`}
                                    onClick={() => setSelectedMenuItem(item)}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-sm text-muted-foreground">{item.category}</p>
                                        </div>
                                        <p className="font-semibold text-orange-600">€{item.price.toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {selectedMenuItem && (
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddItemModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddItemToOrder}
                            disabled={!selectedMenuItem}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                        >
                            Add Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Discount Modal */}
            <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Apply Discount</DialogTitle>
                        <DialogDescription>Apply a discount to this order</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Discount Type</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={discountType === 'percentage' ? 'default' : 'outline'}
                                    onClick={() => setDiscountType('percentage')}
                                    className={discountType === 'percentage' ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white' : ''}
                                >
                                    <Percent className="h-4 w-4 mr-2" />
                                    Percentage
                                </Button>
                                <Button
                                    variant={discountType === 'fixed' ? 'default' : 'outline'}
                                    onClick={() => setDiscountType('fixed')}
                                    className={discountType === 'fixed' ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white' : ''}
                                >
                                    <DollarSign className="h-4 w-4 mr-2" />
                                    Fixed Amount
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Discount Value</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                placeholder={discountType === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDiscountModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApplyDiscount}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                        >
                            Apply Discount
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Order Modal */}
            <Dialog open={manualOrderModalOpen} onOpenChange={setManualOrderModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
                    <DialogHeader>
                        <DialogTitle>Create Manual Order</DialogTitle>
                        <DialogDescription>Create an order for a table without QR code</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select Table (Occupied tables will add to existing order)</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {availableTables.map((table) => (
                                    <Button
                                        key={table.id}
                                        variant={selectedTable?.id === table.id ? 'default' : 'outline'}
                                        onClick={() => setSelectedTable(table)}
                                        className={`relative ${selectedTable?.id === table.id ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white' : table.isOccupied ? 'border-orange-400 bg-orange-50' : ''}`}
                                    >
                                        {table.name}
                                        {table.isOccupied && (
                                            <span className="ml-1 text-xs">●</span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {selectedTable && (
                            <>
                                <div className="space-y-2">
                                    <Label>Add Items</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                        <Input
                                            placeholder="Search menu items..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                                        {filteredMenuItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                                                onClick={() => {
                                                    const newItem: OrderItem = {
                                                        menuItemId: item.id,
                                                        name: item.name,
                                                        price: item.price,
                                                        quantity: 1,
                                                        category: item.category,
                                                    };
                                                    setManualOrderItems([...manualOrderItems, newItem]);
                                                }}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <p className="font-medium text-sm">{item.name}</p>
                                                    <p className="text-sm text-orange-600">€{item.price.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Order Items</Label>
                                    {manualOrderItems.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No items added yet
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {manualOrderItems.map((item, index) => (
                                                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{item.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            €{item.price.toFixed(2)} × {item.quantity}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const newItems = [...manualOrderItems];
                                                                newItems[index].quantity = parseInt(e.target.value) || 1;
                                                                setManualOrderItems(newItems);
                                                            }}
                                                            className="w-16 h-8"
                                                        />
                                                        <p className="font-semibold text-orange-600 w-16 text-right">
                                                            €{(item.price * item.quantity).toFixed(2)}
                                                        </p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700"
                                                            onClick={() => {
                                                                setManualOrderItems(manualOrderItems.filter((_, i) => i !== index));
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="border-t pt-2 text-right">
                                                <p className="font-bold text-lg text-orange-600">
                                                    Total: €{(manualOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.08).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setManualOrderModalOpen(false);
                            setSelectedTable(null);
                            setManualOrderItems([]);
                            setSearchQuery('');
                        }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateManualOrder}
                            disabled={!selectedTable || manualOrderItems.length === 0}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                        >
                            Create Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Bill Modal */}
            <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Print Bill</DialogTitle>
                        <DialogDescription>
                            Select a printer and print the final bill. This will mark the order as completed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {printers.length > 0 && (
                            <div className="space-y-2">
                                <Label>Select Printer (Optional)</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={selectedPrinter}
                                    onChange={(e) => setSelectedPrinter(e.target.value)}
                                >
                                    <option value="">Download PDF Only</option>
                                    {printers.map((printer) => (
                                        <option key={printer.id} value={printer.id}>
                                            {printer.name} ({printer.ipAddress})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="text-sm text-orange-800">
                                <strong>Note:</strong> Printing the bill will mark this order as completed and free up the table.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrintModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePrintBill}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            Print & Complete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
