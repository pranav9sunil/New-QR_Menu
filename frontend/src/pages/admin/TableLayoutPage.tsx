import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc as firestoreDoc,
    setDoc,
    deleteField,
    onSnapshot,
} from 'firebase/firestore';
import type { Table, TableSession, Order } from '@/types';
import { Button } from '@/components/ui/button';
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
import {
    Plus,
    Save,
    ZoomIn,
    ZoomOut,
    Edit2,
    Trash2,
    Eye,
    Grid3x3,
    Layout,
    Receipt,
    CheckCircle,
    Info,
    CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableTable extends Table {
    isDragging?: boolean;
}

export default function TableLayoutDesigner() {
    const { restaurantId } = useAuth();
    const [tables, setTables] = useState<DraggableTable[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [viewMode, setViewMode] = useState<'simple' | 'realistic'>('simple');
    const [isEditing, setIsEditing] = useState(false);
    const [draggedTable, setDraggedTable] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editTableData, setEditTableData] = useState<{ id: string; name: string; seats: number } | null>(null);
    const [newTableSeats, setNewTableSeats] = useState(4);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [activeSessions, setActiveSessions] = useState<Record<string, TableSession>>({});

    // Session Details Dialog State
    const [showSessionDialog, setShowSessionDialog] = useState(false);
    const [selectedTableSession, setSelectedTableSession] = useState<{ table: Table, session: TableSession, orders: Order[] } | null>(null);
    const [sessionLoading, setSessionLoading] = useState(false);

    // Empty Table / Reservation State
    const [selectedEmptyTable, setSelectedEmptyTable] = useState<Table | null>(null);
    const [showEmptyTableDialog, setShowEmptyTableDialog] = useState(false);
    const [isReserving, setIsReserving] = useState(false);
    const [reservationForm, setReservationForm] = useState({ name: '', phone: '', guests: 2, time: '' });

    // Reservation Details State
    const [showReservationDialog, setShowReservationDialog] = useState(false);
    const [selectedReservedTable, setSelectedReservedTable] = useState<Table | null>(null);

    useEffect(() => {
        if (!restaurantId) {
            const timer = setTimeout(() => setLoading(false), 2000);
            return () => clearTimeout(timer);
        }

        // Real-time listener for tables
        const tablesRef = collection(db, 'tables');
        const q = query(tablesRef, where('restaurantId', '==', restaurantId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedTables: Table[] = [];
            snapshot.forEach((doc) => {
                loadedTables.push({ id: doc.id, ...doc.data() } as Table);
            });
            setTables(loadedTables);
            setLoading(false);
        }, (error) => {
            console.error('Error loading tables:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [restaurantId]);

    // Real-time listener for active sessions
    useEffect(() => {
        if (!restaurantId) return;

        const sessionsRef = collection(db, 'sessions');
        const q = query(
            sessionsRef,
            where('restaurantId', '==', restaurantId),
            where('status', 'in', ['active', 'payment_pending'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions: Record<string, TableSession> = {};
            snapshot.forEach((doc) => {
                const data = doc.data() as TableSession;
                sessions[data.tableId] = { ...data, id: doc.id };
            });
            setActiveSessions(sessions);
        }, (error) => {
            console.error('Error loading sessions:', error);
        });

        return () => unsubscribe();
    }, [restaurantId]);

    const addTable = async () => {
        if (!restaurantId) return;

        const tableCount = tables.length + 1;
        const newTable: Omit<Table, 'id'> = {
            restaurantId,
            name: `table_${tableCount}`,
            seats: viewMode === 'realistic' ? newTableSeats : 4,
            position: { x: 50, y: 50 },
            isActive: true,
            createdAt: new Date(),
        };

        try {
            const docRef = await addDoc(collection(db, 'tables'), newTable);
            setTables([...tables, { id: docRef.id, ...newTable }]);
            setShowAddDialog(false);
            setNewTableSeats(4);
        } catch (error) {
            console.error('Error adding table:', error);
            alert('Failed to add table');
        }
    };

    const deleteTable = async (tableId: string) => {
        try {
            await deleteDoc(firestoreDoc(db, 'tables', tableId));
            setTables(tables.filter((t) => t.id !== tableId));
        } catch (error) {
            console.error('Error deleting table:', error);
            alert('Failed to delete table');
        }
    };

    const openEditDialog = (table: Table) => {
        setEditTableData({ id: table.id, name: table.name, seats: table.seats });
        setShowEditDialog(true);
    };

    const handleTableClick = (table: Table) => {
        if (isEditing) return;

        const session = activeSessions[table.id];
        if (session) {
            openSessionDialog(table);
        } else if (table.reservation) {
            setSelectedReservedTable(table);
            setShowReservationDialog(true);
        } else {
            setSelectedEmptyTable(table);
            setReservationForm({ name: '', phone: '', guests: table.seats, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
            setIsReserving(false);
            setShowEmptyTableDialog(true);
        }
    };

    const handleMakeReservation = async () => {
        if (!selectedEmptyTable || !restaurantId) return;
        if (!reservationForm.name || !reservationForm.time) {
            alert('Please fill in Name and Time');
            return;
        }

        try {
            await updateDoc(firestoreDoc(db, 'tables', selectedEmptyTable.id), {
                reservation: reservationForm
            });

            // Update local state
            setTables(tables.map(t => t.id === selectedEmptyTable.id ? { ...t, reservation: reservationForm } : t));

            setShowEmptyTableDialog(false);
            setIsReserving(false);
        } catch (error) {
            console.error('Error making reservation:', error);
            alert('Failed to make reservation');
        }
    };

    const handleCancelReservation = async () => {
        if (!selectedReservedTable) return;

        if (!confirm('Are you sure you want to cancel this reservation?')) return;

        try {
            await updateDoc(firestoreDoc(db, 'tables', selectedReservedTable.id), {
                reservation: deleteField()
            });
            // Update local state
            setTables(tables.map(t => t.id === selectedReservedTable.id ? { ...t, reservation: undefined } : t));

            setShowReservationDialog(false);
            setSelectedReservedTable(null);
        } catch (error) {
            console.error('Error canceling reservation:', error);
            alert('Failed to cancel reservation');
        }
    };

    const openSessionDialog = async (table: Table) => {
        const session = activeSessions[table.id];
        if (!session) return;

        setSessionLoading(true);
        setShowSessionDialog(true);

        try {
            // Fetch orders for this session
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

            // Sort in memory to avoid Firestore index requirement
            orders.sort((a, b) => {
                const getDate = (date: any) => {
                    if (date instanceof Date) return date;
                    if (date && typeof date.toDate === 'function') return date.toDate();
                    if (date && date.seconds) return new Date(date.seconds * 1000);
                    return new Date(date);
                };

                const dateA = getDate(a.createdAt);
                const dateB = getDate(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

            setSelectedTableSession({ table, session, orders });
        } catch (error) {
            console.error('Error loading session details:', error);
        } finally {
            setSessionLoading(false);
        }
    };

    const closeSession = async () => {
        if (!selectedTableSession) return;

        try {
            await updateDoc(firestoreDoc(db, 'sessions', selectedTableSession.session.id), {
                status: 'closed',
                closedAt: new Date()
            });

            // Refresh sessions
            // await loadActiveSessions(); // Removed as we use onSnapshot
            setShowSessionDialog(false);
            setSelectedTableSession(null);
        } catch (error) {
            console.error('Error closing session:', error);
            alert('Failed to close session');
        }
    };

    const handleUpdateTable = async () => {
        if (!editTableData || !restaurantId) return;

        if (tables.some((t) => t.id !== editTableData.id && t.name === editTableData.name)) {
            alert('Table name must be unique!');
            return;
        }

        try {
            await updateDoc(firestoreDoc(db, 'tables', editTableData.id), {
                name: editTableData.name,
                seats: editTableData.seats,
            });
            setTables(
                tables.map((t) =>
                    t.id === editTableData.id
                        ? { ...t, name: editTableData.name, seats: editTableData.seats }
                        : t
                )
            );
            setShowEditDialog(false);
            setEditTableData(null);
        } catch (error) {
            console.error('Error updating table:', error);
            alert('Failed to update table');
        }
    };

    const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
        if (!isEditing) return; // Only allow dragging in edit mode
        e.preventDefault();
        const table = tables.find((t) => t.id === tableId);
        if (!table) return;

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
        setDraggedTable(tableId);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggedTable || !canvasRef.current || !isEditing) return;

        e.preventDefault();
        const canvas = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - canvas.left - dragOffset.x) / zoom;
        const y = (e.clientY - canvas.top - dragOffset.y) / zoom;

        setTables(
            tables.map((t) =>
                t.id === draggedTable
                    ? { ...t, position: { x: Math.max(0, x), y: Math.max(0, y) } }
                    : t
            )
        );
    };

    const handleMouseUp = () => {
        setDraggedTable(null);
    };

    const saveLayout = async () => {
        if (!restaurantId) return;

        setSaving(true);
        try {
            const updatePromises = tables.map((table) =>
                updateDoc(firestoreDoc(db, 'tables', table.id), {
                    position: table.position,
                    seats: table.seats,
                })
            );

            await Promise.all(updatePromises);

            await setDoc(
                firestoreDoc(db, 'restaurants', restaurantId),
                { layoutConfigured: true },
                { merge: true }
            );

            alert('Layout saved successfully!');
            setIsEditing(false); // Exit edit mode after saving
        } catch (error) {
            console.error('Error saving layout:', error);
            alert('Failed to save layout');
        } finally {
            setSaving(false);
        }
    };

    // Calculate totals for selected session
    const sessionSubtotal = selectedTableSession?.orders.reduce((sum, order) => sum + order.subtotal, 0) || 0;
    const sessionTax = selectedTableSession?.orders.reduce((sum, order) => sum + order.tax, 0) || 0;
    const sessionTotal = selectedTableSession?.orders.reduce((sum, order) => sum + order.total, 0) || 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Table Layout</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setViewMode(viewMode === 'simple' ? 'realistic' : 'simple')}
                        title={`Switch to ${viewMode === 'simple' ? 'realistic' : 'simple'} view`}
                    >
                        {viewMode === 'simple' ? <Eye className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>

                    <div className="h-6 w-px bg-gray-300 mx-2" />

                    {isEditing ? (
                        <>
                            <Button onClick={() => (viewMode === 'realistic' ? setShowAddDialog(true) : addTable())}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Table
                            </Button>
                            <Button onClick={saveLayout} disabled={saving}>
                                <Save className="h-4 w-4 mr-2" />
                                {saving ? 'Saving...' : 'Save Layout'}
                            </Button>
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            <Layout className="h-4 w-4 mr-2" />
                            Edit Layout
                        </Button>
                    )}
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div
                    ref={canvasRef}
                    className={cn(
                        'relative min-h-[600px] bg-slate-50',
                        isEditing ? 'cursor-crosshair' : 'cursor-default',
                        viewMode === 'realistic' && 'bg-[url(/restaurant-floor.jpg)] bg-cover bg-center'
                    )}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        width: `${100 / zoom}%`,
                        height: `${100 / zoom}%`,
                    }}
                >
                    {tables.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                            <div className="text-center">
                                <p className="text-lg font-medium">No tables configured</p>
                                <p className="text-sm">Click "Edit Layout" then "Add Table" to get started</p>
                            </div>
                        </div>
                    ) : (
                        tables.map((table) => {
                            const session = activeSessions[table.id];
                            const isPaymentPending = session?.status === 'payment_pending';
                            const isReserved = !!table.reservation;

                            // Determine colors
                            let bgColor = "bg-green-50"; // Empty (Greenish)
                            let borderColor = "border-green-500";
                            let textColor = "text-green-900";

                            if (session) {
                                bgColor = "bg-gray-100"; // Occupied (Grey)
                                borderColor = "border-gray-400";
                                textColor = "text-gray-900";
                                if (isPaymentPending) {
                                    bgColor = "bg-red-50 animate-pulse";
                                    borderColor = "border-red-500";
                                    textColor = "text-red-900";
                                }
                            } else if (isReserved) {
                                bgColor = "bg-orange-50"; // Reserved (Orange)
                                borderColor = "border-orange-500";
                                textColor = "text-orange-900";
                            }

                            return (
                                <div
                                    key={table.id}
                                    className={cn(
                                        'absolute group transition-all select-none',
                                        isEditing && 'cursor-move',
                                        !isEditing && 'cursor-pointer hover:scale-105',
                                        draggedTable === table.id && 'opacity-75 z-50',
                                        !draggedTable && 'z-10'
                                    )}
                                    style={{
                                        left: `${table.position?.x || 0}px`,
                                        top: `${table.position?.y || 0}px`,
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                                    onClick={() => handleTableClick(table)}
                                >
                                    {viewMode === 'simple' ? (
                                        <div className={cn(
                                            "bg-white border-2 rounded-lg p-4 shadow-md min-w-[140px] transition-colors relative",
                                            borderColor,
                                            bgColor
                                        )}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={cn("font-bold", textColor)}>{table.name}</span>
                                                {isEditing && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditDialog(table);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                    </button>
                                                )}
                                                {!isEditing && isReserved && (
                                                    <div className="bg-orange-200 text-orange-800 rounded-full p-1">
                                                        <Info className="h-3 w-3" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-xs text-muted-foreground mt-1">
                                                {table.seats} seats
                                            </div>

                                            {!isEditing && isReserved && table.reservation && (
                                                <div className="mt-2 text-xs border-t border-orange-200 pt-1">
                                                    <div className="font-bold text-orange-800 truncate">{table.reservation.name}</div>
                                                    <div className="flex items-center text-orange-700">
                                                        <CalendarClock className="h-3 w-3 mr-1" />
                                                        {table.reservation.time}
                                                    </div>
                                                </div>
                                            )}

                                            {!isEditing && session && (
                                                <div className={cn(
                                                    "mt-2 text-xs px-2 py-1 rounded font-bold text-center border",
                                                    isPaymentPending
                                                        ? "bg-red-100 text-red-800 border-red-200"
                                                        : "bg-white text-gray-800 border-gray-200"
                                                )}>
                                                    {isPaymentPending ? "BILL READY" : `Code: ${session.code}`}
                                                </div>
                                            )}

                                            {isEditing && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`Delete ${table.name}?`)) {
                                                            deleteTable(table.id);
                                                        }
                                                    }}
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        // Realistic view updates (simplified for now)
                                        <div className="relative">
                                            <div className={cn(
                                                "w-24 h-24 border-2 rounded-full flex items-center justify-center shadow-lg transition-colors",
                                                borderColor,
                                                bgColor
                                            )}>
                                                <span className={cn("font-bold", textColor)}>{table.name}</span>
                                            </div>
                                            {/* ... existing realistic view content ... */}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Add Table Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Add New Table</DialogTitle>
                        <DialogDescription>Select the number of seats for this table</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="seats">Number of Seats</Label>
                            <select
                                id="seats"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={newTableSeats}
                                onChange={(e) => setNewTableSeats(Number(e.target.value))}
                            >
                                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                                    <option key={num} value={num}>
                                        {num} {num === 1 ? 'seat' : 'seats'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={addTable}>Add Table</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Table Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Edit Table</DialogTitle>
                        <DialogDescription>Update table details</DialogDescription>
                    </DialogHeader>
                    {editTableData && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Table Name</Label>
                                <Input
                                    id="edit-name"
                                    value={editTableData.name}
                                    onChange={(e) =>
                                        setEditTableData({ ...editTableData, name: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-seats">Number of Seats</Label>
                                <select
                                    id="edit-seats"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={editTableData.seats}
                                    onChange={(e) =>
                                        setEditTableData({
                                            ...editTableData,
                                            seats: Number(e.target.value),
                                        })
                                    }
                                >
                                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                                        <option key={num} value={num}>
                                            {num} {num === 1 ? 'seat' : 'seats'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateTable}>Update Table</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Session Details / Bill Dialog */}
            <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Table Bill: {selectedTableSession?.table.name}
                        </DialogTitle>
                        <DialogDescription>
                            Session Code: {selectedTableSession?.session.code}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        {sessionLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : !selectedTableSession?.orders.length ? (
                            <div className="text-center text-muted-foreground py-8">
                                <p>No orders placed in this session.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {selectedTableSession.orders.map((order, index) => (
                                    <div key={order.id} className="border-b pb-4 last:border-0">
                                        <div className="font-medium mb-2 text-sm text-muted-foreground">
                                            Order #{index + 1} • {order.status}
                                        </div>
                                        {order.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm mb-1">
                                                <span>{item.quantity}x {item.name}</span>
                                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedTableSession && selectedTableSession.orders.length > 0 && (
                        <div className="space-y-2 pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 mt-auto">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>${sessionSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Tax:</span>
                                <span>${sessionTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold text-primary">
                                <span>Total Due:</span>
                                <span>${sessionTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="sm:justify-between gap-2">
                        <Button variant="outline" onClick={() => setShowSessionDialog(false)}>
                            Close
                        </Button>
                        <Button
                            onClick={closeSession}
                            variant="destructive"
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Finish Billing & Clear Table
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Empty Table / Reservation Dialog */}
            <Dialog open={showEmptyTableDialog} onOpenChange={setShowEmptyTableDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>{selectedEmptyTable?.name}</DialogTitle>
                        <DialogDescription>
                            {selectedEmptyTable?.seats} seats • Status: Empty
                        </DialogDescription>
                    </DialogHeader>

                    {!isReserving ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="text-muted-foreground">
                                <p>This table is currently empty.</p>
                                <p className="text-sm mt-1">Waiting for customers to scan the QR code.</p>
                            </div>
                            <Button onClick={() => setIsReserving(true)} className="w-full">
                                <CalendarClock className="h-4 w-4 mr-2" />
                                Make Reservation
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Customer Name</Label>
                                <Input
                                    value={reservationForm.name}
                                    onChange={(e) => setReservationForm({ ...reservationForm, name: e.target.value })}
                                    placeholder="Enter name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                    value={reservationForm.phone}
                                    onChange={(e) => setReservationForm({ ...reservationForm, phone: e.target.value })}
                                    placeholder="Enter phone"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Guests</Label>
                                    <Input
                                        type="number"
                                        value={reservationForm.guests}
                                        onChange={(e) => setReservationForm({ ...reservationForm, guests: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time</Label>
                                    <Input
                                        type="time"
                                        value={reservationForm.time}
                                        onChange={(e) => setReservationForm({ ...reservationForm, time: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        {isReserving ? (
                            <>
                                <Button variant="outline" onClick={() => setIsReserving(false)}>Cancel</Button>
                                <Button onClick={handleMakeReservation}>Confirm Reservation</Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setShowEmptyTableDialog(false)}>
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reservation Details Dialog */}
            <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="bg-orange-100 p-2 rounded-full">
                                <CalendarClock className="h-5 w-5 text-orange-600" />
                            </div>
                            Reserved: {selectedReservedTable?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Reservation Details
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReservedTable?.reservation && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-muted-foreground text-xs">Name</Label>
                                    <div className="font-medium text-lg">{selectedReservedTable.reservation.name}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Time</Label>
                                    <div className="font-medium text-lg">{selectedReservedTable.reservation.time}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Phone</Label>
                                    <div className="font-medium">{selectedReservedTable.reservation.phone || 'N/A'}</div>
                                </div>
                                <div>
                                    <Label className="text-muted-foreground text-xs">Guests</Label>
                                    <div className="font-medium">{selectedReservedTable.reservation.guests} people</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:justify-between">
                        <Button variant="outline" onClick={() => setShowReservationDialog(false)}>
                            Close
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleCancelReservation}
                        >
                            Cancel Reservation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
