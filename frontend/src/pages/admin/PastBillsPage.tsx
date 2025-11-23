import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Receipt, Calendar } from 'lucide-react';

export default function PastBillsPage() {
    const { restaurantId } = useAuth();
    const [sessions, setSessions] = useState<TableSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<{ session: TableSession, orders: Order[] } | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        if (restaurantId) {
            loadPastSessions();
        }
    }, [restaurantId]);

    const loadPastSessions = async () => {
        if (!restaurantId) return;
        const sessionsRef = collection(db, 'sessions');
        try {
            // Note: Composite index might be needed for this query
            // restaurantId + status + createdAt
            const q = query(
                sessionsRef,
                where('restaurantId', '==', restaurantId),
                where('status', '==', 'closed'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const loadedSessions: TableSession[] = [];
            snapshot.forEach((doc) => {
                loadedSessions.push({ id: doc.id, ...doc.data() } as TableSession);
            });
            setSessions(loadedSessions);
        } catch (error) {
            console.error('Error loading past sessions:', error);
            // Fallback if index is missing: fetch all closed and sort client-side (not ideal for large data but works for now)
            try {
                const qFallback = query(
                    sessionsRef,
                    where('restaurantId', '==', restaurantId),
                    where('status', '==', 'closed')
                );
                const snapshot = await getDocs(qFallback);
                const loadedSessions: TableSession[] = [];
                snapshot.forEach((doc) => {
                    loadedSessions.push({ id: doc.id, ...doc.data() } as TableSession);
                });

                loadedSessions.sort((a, b) => {
                    const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate() : new Date(a.createdAt);
                    const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate() : new Date(b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                });

                setSessions(loadedSessions);
            } catch (fallbackError) {
                console.error("Fallback failed", fallbackError);
            }
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
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    };

    const calculateTotal = (orders: Order[]) => {
        return orders.reduce((sum, order) => sum + order.total, 0);
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
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Past Bills</h1>
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
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Bill Details
                        </DialogTitle>
                        <DialogDescription>
                            {selectedSession?.session.tableName} • {formatDate(selectedSession?.session.createdAt)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        {detailsLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : !selectedSession || selectedSession.orders.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <p>No orders found for this session.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {selectedSession.orders.map((order, index) => (
                                    <div key={order.id} className="border-b pb-4 last:border-0">
                                        <div className="font-medium mb-2 text-sm text-muted-foreground">
                                            Order #{index + 1}
                                        </div>
                                        {order.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm mb-1">
                                                <span>{item.quantity}x {item.name}</span>
                                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-sm font-medium mt-2 text-slate-600">
                                            <span>Subtotal</span>
                                            <span>${order.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedSession && selectedSession.orders.length > 0 && (
                        <div className="space-y-2 pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 mt-auto">
                            <div className="flex justify-between text-xl font-bold text-primary">
                                <span>Total Bill:</span>
                                <span>${calculateTotal(selectedSession.orders).toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setDetailsOpen(false)} className="w-full">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
