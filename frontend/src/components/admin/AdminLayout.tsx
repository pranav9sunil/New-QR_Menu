import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    ChefHat,
    LayoutGrid,
    QrCode,
    Menu,
    LogOut,
    Settings,
    MenuSquare,
    Receipt,
    BarChart3,
    Wine,
    Printer,
    Monitor,
    GripVertical,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import SettingsModal from './SettingsModal';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Users } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import type { Role, PrinterDevice, SessionWithOrders, Order } from '@/types';
import { printDirect, categorizeItems } from '@/utils/receiptGenerator';

const DEFAULT_MENU_ITEMS = [
    {
        label: 'Table Layout',
        icon: LayoutGrid,
        path: '/admin/layout',
        id: 'layout',
    },
    {
        label: 'Live Kitchen',
        icon: ChefHat,
        path: '/admin/kitchen',
        id: 'kitchen',
    },
    {
        label: 'Live Bar',
        icon: Wine,
        path: '/admin/bar',
        id: 'bar',
    },
    {
        label: 'Live Bills',
        icon: Receipt,
        path: '/admin/live-bills',
        id: 'live-bills',
    },
    {
        label: 'TPV (Manual Order)',
        icon: Monitor,
        path: '/admin/tpv',
        id: 'tpv',
    },
    {
        label: 'Printers',
        icon: Printer,
        path: '/admin/printers',
        id: 'printers',
    },
    {
        label: 'Menu Management',
        icon: MenuSquare,
        path: '/admin/menu',
        id: 'menu',
    },
    {
        label: 'Accounts',
        icon: BarChart3,
        path: '/admin/accounts',
        id: 'accounts',
    },
    {
        label: 'Past Bills',
        icon: Receipt,
        path: '/admin/bills',
        id: 'bills',
    },
    {
        label: 'QR Codes',
        icon: QrCode,
        path: '/admin/qr-codes',
        id: 'qr-codes',
    },
    {
        label: 'Reservations',
        icon: Receipt,
        path: '/admin/reservations',
        id: 'reservations',
    },
    {
        label: 'Table Codes',
        icon: QrCode, // Reusing QrCode icon or Hash if available, importing Hash above might be needed or just use Hash from imports if added.
        // Wait, I need to check imports in AdminLayout. The existing imports are: ChefHat, LayoutGrid, QrCode, Menu, LogOut, Settings, MenuSquare, Receipt, BarChart3, Wine, Printer, Monitor, GripVertical.
        // Hash is not imported. I should add it or use QrCode/Monitor. 'QrCode' makes sense or 'Monitor'.
        // Let's use 'QrCode' for now as it's relevant (codes), OR wait, Table Codes are 2 digits. QrCode is used for 'QR Codes'.
        // I will add 'Hash' to imports first using multi_replace.
        path: '/admin/table-codes',
        id: 'table-codes',
    },
    {
        label: 'Users & Roles',
        icon: Users,
        path: '/admin/users',
        id: 'users',
    },
];

function SortableSidebarItem({ item, onClick }: { item: any, onClick?: () => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: 'relative' as 'relative',
    };

    const Icon = item.icon;

    return (
        <div ref={setNodeRef} style={style} className="group relative flex items-center">
            <Link
                to={item.path}
                onClick={onClick}
                className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <Icon className="h-4 w-4" />
                {item.label}
            </Link>
            <div
                {...attributes}
                {...listeners}
                className="absolute right-2 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
                <GripVertical className="h-4 w-4" />
            </div>
        </div>
    );
}

export default function AdminLayout() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { restaurantId, signOut, userData } = useAuth(); // Corrected structure
    const navigate = useNavigate();
    // Removed unused states: isMenuOpen, userRole

    // Auto-Print Logic State
    const [printers, setPrinters] = useState<PrinterDevice[]>([]);
    const [activeSessions, setActiveSessions] = useState<SessionWithOrders[]>([]);

    // REAL IMPLEMENTATION OF AUTO-PRINT IN LAYOUT
    // We need a stable list of SessionsWithOrders.
    useEffect(() => {
        if (!restaurantId) return;

        // Listen to Printers
        const qPrinters = query(collection(db, 'printers'), where('restaurantId', '==', restaurantId));
        const unsubPrinters = onSnapshot(qPrinters, sn => setPrinters(sn.docs.map(d => ({ id: d.id, ...d.data() } as PrinterDevice))));

        // Listen to Active Sessions (tables)
        const qSessions = query(collection(db, 'sessions'), where('restaurantId', '==', restaurantId), where('status', 'in', ['active', 'payment_pending']));

        // Listen to Orders
        const qOrders = query(collection(db, 'orders'), where('restaurantId', '==', restaurantId));

        let currentSessions: any[] = [];
        let currentOrders: Order[] = [];

        const updateSessionsWithOrders = () => {
            const mapped = currentSessions.map(s => {
                const sOrders = currentOrders.filter(o => o.sessionId === s.id);
                // Sort orders by time if needed, handled by print logic
                return {
                    sessionId: s.id,
                    tableName: s.tableName,
                    tableId: s.tableId,
                    orders: sOrders,
                    totalAmount: 0
                } as SessionWithOrders;
            });
            setActiveSessions(mapped);
        };

        const unsubSessions = onSnapshot(qSessions, (sn) => {
            currentSessions = sn.docs.map(d => ({ id: d.id, ...d.data() }));
            updateSessionsWithOrders();
        });

        const unsubOrders = onSnapshot(qOrders, (sn) => {
            currentOrders = sn.docs.map(d => ({ id: d.id, ...d.data() } as Order));
            updateSessionsWithOrders();
        });

        return () => {
            unsubPrinters();
            unsubSessions();
            unsubOrders();
        }
    }, [restaurantId]);

    // Check Auto-Print EFFECT
    useEffect(() => {
        const checkAutoPrint = async () => {
            const isAutoPrintEnabled = localStorage.getItem('auto_print_enabled') === 'true';

            console.log('[AutoPrint Debug] State Check:', {
                enabled: isAutoPrintEnabled,
                printersFound: printers.length,
                activeSessions: activeSessions.length,
                totalOrdersTracked: activeSessions.reduce((acc, s) => acc + s.orders.length, 0)
            });

            if (!isAutoPrintEnabled || printers.length === 0) return;

            const printedOrderIds = JSON.parse(localStorage.getItem('printed_orders') || '[]');
            let newPrintedIds = [...printedOrderIds];
            let hasNewPrints = false;

            for (const session of activeSessions) {
                const unprintedOrders = session.orders.filter(order => !newPrintedIds.includes(order.id));

                if (unprintedOrders.length > 0) {
                    console.log(`[AutoPrint Debug] Found ${unprintedOrders.length} unprinted orders for ${session.tableName}`);
                }

                for (const order of unprintedOrders) {
                    const { kitchenItems, barItems } = categorizeItems(order.items);

                    if (kitchenItems.length > 0) {
                        const kitchenPrinter = printers.find(p => p.type === 'kitchen');
                        if (kitchenPrinter) {
                            try {
                                await printDirect(kitchenPrinter.ipAddress || 'localhost', kitchenPrinter.port || '9100', session, kitchenItems, 'KITCHEN TICKET', false);
                                console.log(`Auto-printed Kitchen Order: ${order.id}`);
                            } catch (e) { console.error('Auto-print Kitchen failed', e); }
                        }
                    }

                    if (barItems.length > 0) {
                        const barPrinter = printers.find(p => p.type === 'bar');
                        if (barPrinter) {
                            try {
                                await printDirect(barPrinter.ipAddress || 'localhost', barPrinter.port || '9100', session, barItems, 'BAR TICKET', false);
                                console.log(`Auto-printed Bar Order: ${order.id}`);
                            } catch (e) { console.error('Auto-print Bar failed', e); }
                        }
                    }

                    newPrintedIds.push(order.id);
                    hasNewPrints = true;
                }
            }

            if (hasNewPrints) {
                if (newPrintedIds.length > 500) newPrintedIds = newPrintedIds.slice(-500);
                localStorage.setItem('printed_orders', JSON.stringify(newPrintedIds));
            }
        };

        checkAutoPrint();
    }, [activeSessions, printers]);

    // Auth Check
    const [userPermissions, setUserPermissions] = useState<string[] | null>(null);

    // Fetch Role Permissions
    useEffect(() => {
        if (!userData) return;

        const fetchRole = async () => {
            // Default: Owner/Admin sees everything if no specific roleId
            if (userData.role === 'owner' || userData.role === 'admin') {
                if (!userData.roleId) {
                    setUserPermissions(null); // Null means ALL access
                    return;
                }
            }

            if (userData.roleId) {
                try {
                    const roleDoc = await getDoc(doc(db, 'roles', userData.roleId));
                    if (roleDoc.exists()) {
                        const roleData = roleDoc.data() as Role;
                        setUserPermissions(roleData.permissions);
                    } else {
                        // Role deleted or invalid? Fallback to basic access
                        setUserPermissions([]);
                    }
                } catch (error) {
                    console.error("Error fetching permissions:", error);
                }
            } else {
                // Regular employee with no role assigned? Basic access or none.
                setUserPermissions([]);
            }
        };

        fetchRole();
    }, [userData]);


    const [sidebarItems, setSidebarItems] = useState(() => {
        // Initial load
        return DEFAULT_MENU_ITEMS;
    });

    // Update Sidebar items when permissions change
    useEffect(() => {
        // Get LocalStorage Order
        const savedOrderStr = localStorage.getItem('admin_sidebar_order');
        let orderedItems = DEFAULT_MENU_ITEMS;

        if (savedOrderStr) {
            try {
                const orderIds = JSON.parse(savedOrderStr);
                const reordered = orderIds
                    .map((id: string) => DEFAULT_MENU_ITEMS.find(item => item.id === id))
                    .filter(Boolean);
                const newItems = DEFAULT_MENU_ITEMS.filter(item => !orderIds.includes(item.id));
                orderedItems = [...reordered, ...newItems];
            } catch (e) {
                console.error('Failed to parse sidebar order', e);
            }
        }

        // Apply Permission Filter
        if (userPermissions !== null) {
            // Filter orderedItems based on permissions
            const filtered = orderedItems.filter(item => userPermissions.includes(item.id));
            setSidebarItems(filtered);
        } else {
            // Show all
            setSidebarItems(orderedItems);
        }

    }, [userPermissions]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setSidebarItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Only save order of items currently visible? 
                // Better: Save the order, but filter on render/effect?
                // For simplicity, we just save the ID list.
                localStorage.setItem('admin_sidebar_order', JSON.stringify(newItems.map(i => i.id)));
                return newItems;
            });
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const SidebarContent = () => (
        <div className="h-full flex flex-col">
            <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground">Logged in as</p>
                <p className="font-medium truncate">{userData?.name || userData?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
            </div>

            <nav className="space-y-1 flex-1 overflow-y-auto">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sidebarItems.map(item => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {sidebarItems.map((item) => (
                            <SortableSidebarItem
                                key={item.id}
                                item={item}
                                onClick={() => setMobileOpen(false)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </nav>
        </div>
    );

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            {/* Navbar */}
            <header className="flex h-16 flex-none items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-4 md:hidden"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-4 pt-10 bg-white">
                        <SheetHeader className="mb-4 text-left">
                            <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <SidebarContent />
                    </SheetContent>
                </Sheet>

                <div className="flex items-center gap-2">
                    <img src="/thali_logo.jpg" alt="Thali Logo" className="w-10 h-10 rounded-full object-cover bg-white" />
                    <span className="font-semibold text-lg hidden sm:inline-block">
                        Thali Admin
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                    >
                        <Settings className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        title="Sign Out"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Desktop */}
                <aside className="w-64 flex-none border-r bg-white hidden md:block overflow-y-auto">
                    <div className="p-4 h-full">
                        <SidebarContent />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>

            {/* Settings Modal */}
            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
}
