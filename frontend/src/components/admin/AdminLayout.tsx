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
    const { signOut, userData } = useAuth();
    const navigate = useNavigate();

    const [sidebarItems, setSidebarItems] = useState(() => {
        const savedOrder = localStorage.getItem('admin_sidebar_order');
        if (savedOrder) {
            try {
                const orderIds = JSON.parse(savedOrder);
                const orderedItems = orderIds
                    .map((id: string) => DEFAULT_MENU_ITEMS.find(item => item.id === id))
                    .filter(Boolean);

                // Add any new items that weren't in the saved order
                const newItems = DEFAULT_MENU_ITEMS.filter(item => !orderIds.includes(item.id));
                return [...orderedItems, ...newItems];
            } catch (e) {
                console.error('Failed to parse sidebar order', e);
                return DEFAULT_MENU_ITEMS;
            }
        }
        return DEFAULT_MENU_ITEMS;
    });

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
                    <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                        <ChefHat className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-lg hidden sm:inline-block">
                        QR Ordering System
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
