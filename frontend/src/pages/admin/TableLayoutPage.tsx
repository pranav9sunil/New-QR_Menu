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
    serverTimestamp,
} from 'firebase/firestore';
import type { Table, TableSession, Order, Layout as TableLayout } from '@/types';
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
    ChevronDown,
    MoveRight,
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

    // Layout State
    const [layouts, setLayouts] = useState<TableLayout[]>([]);
    const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);
    const [showNewLayoutDialog, setShowNewLayoutDialog] = useState(false);
    const [newLayoutName, setNewLayoutName] = useState('');
    const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
    const [editingLayout, setEditingLayout] = useState<TableLayout | null>(null);
    const [showEditLayoutDialog, setShowEditLayoutDialog] = useState(false);

    // Move Order State
    const [showMoveDropdown, setShowMoveDropdown] = useState(false);
    const [movingOrder, setMovingOrder] = useState(false);

    useEffect(() => {
        console.log('🔍 TableLayoutPage - restaurantId:', restaurantId);

        if (!restaurantId) {
            console.log('⚠️ No restaurantId - waiting...');
            const timer = setTimeout(() => setLoading(false), 2000);
            return () => clearTimeout(timer);
        }

        console.log('📡 Setting up real-time listener for tables with restaurantId:', restaurantId);

        // Real-time listener for tables
        const tablesRef = collection(db, 'tables');
        const q = query(tablesRef, where('restaurantId', '==', restaurantId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('📊 Tables snapshot received. Size:', snapshot.size);
            const loadedTables: Table[] = [];
            snapshot.forEach((doc) => {
                console.log('  - Table:', doc.id, doc.data());
                loadedTables.push({ id: doc.id, ...doc.data() } as Table);
            });
            console.log('✅ Loaded tables:', loadedTables.length);
            setTables(loadedTables);
            setLoading(false);
        }, (error) => {
            console.error('❌ Error loading tables:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [restaurantId]);

    // Load Layouts
    useEffect(() => {
        if (!restaurantId) return;
        const layoutsRef = collection(db, 'layouts');
        const q = query(layoutsRef, where('restaurantId', '==', restaurantId));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const loadedLayouts: TableLayout[] = [];
            snapshot.forEach((doc) => {
                loadedLayouts.push({ id: doc.id, ...doc.data() } as TableLayout);
            });

            // Sort by creation time if available
            loadedLayouts.sort((a, b) => {
                const getMillis = (date: any) => {
                    if (!date) return 0;
                    if (date.seconds) return date.seconds * 1000;
                    if (date instanceof Date) return date.getTime();
                    return 0;
                };
                return getMillis(a.createdAt) - getMillis(b.createdAt);
            });

            if (loadedLayouts.length === 0) {
                // Try to create default layout, but if it fails (permissions), use a virtual one
                try {
                    await addDoc(collection(db, 'layouts'), {
                        restaurantId,
                        name: 'Main Hall',
                        createdAt: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Error creating default layout (likely permissions):", e);
                    // Fallback: Use virtual layout so tables are visible
                    const virtualLayout: TableLayout = {
                        id: 'default',
                        restaurantId,
                        name: 'Main Hall',
                        createdAt: new Date()
                    };
                    setLayouts([virtualLayout]);
                    setCurrentLayoutId('default');
                }
            } else {
                setLayouts(loadedLayouts);
                setCurrentLayoutId(prev => {
                    if (prev && loadedLayouts.find(l => l.id === prev)) return prev;
                    return loadedLayouts[0].id;
                });
            }
        }, (error) => {
            console.error("Error loading layouts:", error);
            // Fallback on error
            const virtualLayout: TableLayout = {
                id: 'default',
                restaurantId,
                name: 'Main Hall',
                createdAt: new Date()
            };
            setLayouts([virtualLayout]);
            setCurrentLayoutId('default');
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
            layoutId: currentLayoutId || undefined
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
                    layoutId: table.layoutId || currentLayoutId // Ensure layoutId is saved
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

    const handleCreateLayout = async () => {
        if (!newLayoutName.trim() || !restaurantId) return;

        try {
            const docRef = await addDoc(collection(db, 'layouts'), {
                restaurantId,
                name: newLayoutName.trim(),
                createdAt: serverTimestamp()
            });

            setNewLayoutName('');
            setShowNewLayoutDialog(false);
            setCurrentLayoutId(docRef.id);
        } catch (error: any) {
            console.error('Error creating layout:', error);
            if (error.code === 'permission-denied') {
                alert('Permission denied: You need to update your Firestore Security Rules to allow creating layouts. See FIRESTORE_RULES_UPDATE_LAYOUTS.md');
            } else {
                alert('Failed to create layout');
            }
        }
    };

    const handleUpdateLayout = async () => {
        if (!editingLayout || !editingLayout.name.trim()) return;

        try {
            await updateDoc(firestoreDoc(db, 'layouts', editingLayout.id), {
                name: editingLayout.name.trim()
            });

            // Optimistic update
            setLayouts(layouts.map(l => l.id === editingLayout.id ? { ...l, name: editingLayout.name.trim() } : l));

            setShowEditLayoutDialog(false);
            setEditingLayout(null);
        } catch (error) {
            console.error('Error updating layout:', error);
            alert('Failed to update layout');
        }
    };

    // Move order to another table
    const handleMoveOrder = async (targetTableId: string) => {
        if (!selectedTableSession || !restaurantId) return;

        const sourceSession = selectedTableSession.session;
        const sourceOrders = selectedTableSession.orders;
        const targetTable = tables.find(t => t.id === targetTableId);
        const targetSession = activeSessions[targetTableId];

        if (!targetTable) return;

        setMovingOrder(true);
        setShowMoveDropdown(false);

        try {
            if (targetSession) {
                // Target table is occupied - MERGE orders
                // Update all source orders to point to target session
                for (const order of sourceOrders) {
                    await updateDoc(firestoreDoc(db, 'orders', order.id), {
                        sessionId: targetSession.id,
                        tableId: targetTableId,
                        tableName: targetTable.name,
                    });
                }

                // Close the source session
                await updateDoc(firestoreDoc(db, 'sessions', sourceSession.id), {
                    status: 'closed',
                    closedAt: new Date(),
                });

                alert(`Orders merged with ${targetTable.name}`);
            } else {
                // Target table is empty - MOVE session
                // Update the session to point to the new table
                await updateDoc(firestoreDoc(db, 'sessions', sourceSession.id), {
                    tableId: targetTableId,
                    tableName: targetTable.name,
                });

                // Update all orders to point to new table
                for (const order of sourceOrders) {
                    await updateDoc(firestoreDoc(db, 'orders', order.id), {
                        tableId: targetTableId,
                        tableName: targetTable.name,
                    });
                }

                alert(`Order moved to ${targetTable.name}`);
            }

            setShowSessionDialog(false);
            setSelectedTableSession(null);
        } catch (error) {
            console.error('Error moving order:', error);
            alert('Failed to move order');
        } finally {
            setMovingOrder(false);
        }
    };



    // Filter tables for current layout
    const filteredTables = tables.filter(t => {
        if (!currentLayoutId) return false;

        // If exact match
        if (t.layoutId === currentLayoutId) return true;

        // Backward compatibility & Virtual Default Layout:
        // Show tables without layoutId if we are on the first layout (or default virtual one)
        const isFirstOrDefault = layouts.length > 0 && (currentLayoutId === layouts[0].id || currentLayoutId === 'default');
        if (!t.layoutId && isFirstOrDefault) return true;

        return false;
    });

    // Calculate totals for selected session
    const sessionSubtotal = selectedTableSession?.orders.reduce((sum, order) => sum + order.subtotal, 0) || 0;
    const sessionTax = selectedTableSession?.orders.reduce((sum, order) => sum + order.tax, 0) || 0;
    const sessionTip = selectedTableSession?.session.tipAmount || 0;
    const sessionTotal = (selectedTableSession?.orders.reduce((sum, order) => sum + order.total, 0) || 0) + sessionTip;

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
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold">Table Layout</h1>

                    {/* Layout Selector */}
                    <div className="relative">
                        <Button
                            variant="outline"
                            className="w-48 justify-between"
                            onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
                        >
                            {layouts.find(l => l.id === currentLayoutId)?.name || 'Loading...'}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>

                        {isLayoutDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md border shadow-lg z-50 py-1">
                                {layouts.map(layout => (
                                    <div
                                        key={layout.id}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 transition-colors group",
                                            currentLayoutId === layout.id && "bg-gray-50 font-medium text-primary"
                                        )}
                                    >
                                        <button
                                            className="flex-1 text-left"
                                            onClick={() => {
                                                setCurrentLayoutId(layout.id);
                                                setIsLayoutDropdownOpen(false);
                                            }}
                                        >
                                            {layout.name}
                                        </button>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLayout(layout);
                                                setShowEditLayoutDialog(true);
                                                setIsLayoutDropdownOpen(false);
                                            }}
                                            title="Rename Layout"
                                        >
                                            <Edit2 className="h-3 w-3 text-gray-500" />
                                        </button>
                                    </div>
                                ))}
                                <div className="border-t my-1" />
                                <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-primary flex items-center"
                                    onClick={() => {
                                        setIsLayoutDropdownOpen(false);
                                        setShowNewLayoutDialog(true);
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-2" />
                                    Add New Layout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
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
                    {filteredTables.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                            <div className="text-center">
                                <p className="text-lg font-medium">No tables in this layout</p>
                                <p className="text-sm">Click "Edit Layout" then "Add Table" to get started</p>
                            </div>
                        </div>
                    ) : (
                        filteredTables.map((table) => {
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
                                                    {isPaymentPending ? (
                                                        <div className="flex flex-col">
                                                            <span>BILL READY</span>
                                                            <span className="text-[10px] font-medium">
                                                                {(session as any).paymentType === 'split'
                                                                    ? '💳 Split Payment'
                                                                    : (session as any).paymentMethod === 'cash'
                                                                        ? '💵 Cash'
                                                                        : '💳 Card'}
                                                            </span>
                                                        </div>
                                                    ) : `Code: ${session.code}`}
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
                    <DialogHeader className="relative">
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5" />
                            Table Bill: {selectedTableSession?.table.name}
                        </DialogTitle>
                        <DialogDescription>
                            Session Code: {selectedTableSession?.session.code}
                        </DialogDescription>

                        {/* Move Button - Top Right */}
                        <div className="absolute top-0 right-8">
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                                    disabled={movingOrder}
                                >
                                    <MoveRight className="h-4 w-4 mr-1" />
                                    {movingOrder ? 'Moving...' : 'Move'}
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>

                                {showMoveDropdown && (
                                    <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md border shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
                                        {filteredTables
                                            .filter(t => t.id !== selectedTableSession?.table.id)
                                            .map(table => {
                                                const isOccupied = !!activeSessions[table.id];
                                                return (
                                                    <button
                                                        key={table.id}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex justify-between items-center"
                                                        onClick={() => handleMoveOrder(table.id)}
                                                    >
                                                        <span>{table.name}</span>
                                                        {isOccupied && (
                                                            <span className="text-xs text-orange-600 font-medium">Merge</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        {filteredTables.filter(t => t.id !== selectedTableSession?.table.id).length === 0 && (
                                            <div className="px-3 py-2 text-sm text-muted-foreground">No other tables</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
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
                                                <span>€{(item.price * item.quantity).toFixed(2)}</span>
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
                                <span>€{sessionSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Tax (8%):</span>
                                <span>€{sessionTax.toFixed(2)}</span>
                            </div>
                            {sessionTip > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>Server Tip:</span>
                                    <span>€{sessionTip.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                <span>Total:</span>
                                <span>€{sessionTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-between gap-2">
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

            {/* New Layout Dialog */}
            <Dialog open={showNewLayoutDialog} onOpenChange={setShowNewLayoutDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Create New Layout</DialogTitle>
                        <DialogDescription>Enter a name for the new layout (e.g., "Patio", "Bar")</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="layoutName">Layout Name</Label>
                            <Input
                                id="layoutName"
                                value={newLayoutName}
                                onChange={(e) => setNewLayoutName(e.target.value)}
                                placeholder="Main Hall"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewLayoutDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateLayout}>Create Layout</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Layout Dialog */}
            <Dialog open={showEditLayoutDialog} onOpenChange={setShowEditLayoutDialog}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>Edit Layout Name</DialogTitle>
                        <DialogDescription>Update the name of this layout</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="editLayoutName">Layout Name</Label>
                            <Input
                                id="editLayoutName"
                                value={editingLayout?.name || ''}
                                onChange={(e) => setEditingLayout(prev => prev ? { ...prev, name: e.target.value } : null)}
                                placeholder="Layout Name"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditLayoutDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateLayout}>Update Layout</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
