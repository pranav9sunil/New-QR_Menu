import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    onSnapshot
} from 'firebase/firestore';
import type { Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Wine } from 'lucide-react';

interface BarOrder extends Order {
    sessionStatus?: string;
}

export default function BarPage() {
    const { restaurantId } = useAuth();
    const [orders, setOrders] = useState<BarOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!restaurantId) return;

        // Listen for active sessions first to get valid session IDs
        const sessionsRef = collection(db, 'sessions');
        const sessionsQuery = query(
            sessionsRef,
            where('restaurantId', '==', restaurantId),
            where('status', 'in', ['active', 'payment_pending'])
        );

        const unsubscribeSessions = onSnapshot(sessionsQuery, (sessionSnapshot) => {
            const activeSessionIds = new Set<string>();
            sessionSnapshot.forEach((doc) => {
                activeSessionIds.add(doc.id);
            });

            // Listen for orders
            const ordersRef = collection(db, 'orders');
            const ordersQuery = query(
                ordersRef,
                where('restaurantId', '==', restaurantId),
                where('status', '==', 'pending')
            );

            const unsubscribeOrders = onSnapshot(ordersQuery, (orderSnapshot) => {
                const loadedOrders: BarOrder[] = [];
                orderSnapshot.forEach((doc) => {
                    const data = doc.data() as Order;
                    // Only include orders from active sessions
                    if (activeSessionIds.has(data.sessionId || '')) {
                        // Filter items: Only include drink items
                        const drinkItems = data.items.filter(item =>
                            item.category?.toLowerCase() === 'drinks' ||
                            item.category?.toLowerCase() === 'drink'
                        );

                        // Only add to bar if there are drink items
                        if (drinkItems.length > 0) {
                            loadedOrders.push({
                                ...data,
                                id: doc.id,
                                items: drinkItems // Replace items with filtered list
                            });
                        }
                    }
                });

                // Sort by time
                loadedOrders.sort((a, b) => {
                    const dateA = (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt);
                    const dateB = (b.createdAt as any).toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt);
                    return dateA.getTime() - dateB.getTime();
                });

                setOrders(loadedOrders);
                setLoading(false);
            });

            return () => unsubscribeOrders();
        });

        return () => unsubscribeSessions();
    }, [restaurantId]);



    // Group orders by table
    const ordersByTable: Record<string, BarOrder[]> = {};
    orders.forEach(order => {
        if (!ordersByTable[order.tableName]) {
            ordersByTable[order.tableName] = [];
        }
        ordersByTable[order.tableName].push(order);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Wine className="h-8 w-8" />
                    Live Bar View
                </h1>
                <div className="text-muted-foreground">
                    {orders.length} Active Drink Orders
                </div>
            </div>

            {Object.keys(ordersByTable).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <p className="text-xl">No active drink orders</p>
                        <p className="text-sm">Drink orders will appear here when customers place them</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Object.entries(ordersByTable).map(([tableName, tableOrders]) => (
                        <Card key={tableName} className="border-2 shadow-md">
                            <CardHeader className="bg-muted/50 pb-3">
                                <CardTitle className="flex justify-between items-center text-xl">
                                    <span>{tableName}</span>
                                    <Badge variant="outline" className="bg-white">
                                        {tableOrders.length} Orders
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                                {tableOrders.map((order) => (
                                    <div key={order.id} className="bg-white border rounded-lg p-3 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {((order.createdAt as any).toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt))
                                                    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                }
                                            </div>
                                        </div>

                                        <div className="space-y-1 mb-3">
                                            {order.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm font-medium">
                                                    <span>{item.quantity}x {item.name}</span>
                                                </div>
                                            ))}
                                        </div>


                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
