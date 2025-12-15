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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SettingsModal from './SettingsModal';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function AdminLayout() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { signOut, userData } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const menuItems = [
        {
            label: 'Table Layout',
            icon: LayoutGrid,
            path: '/admin/layout',
        },
        {
            label: 'Live Kitchen',
            icon: ChefHat,
            path: '/admin/kitchen',
        },
        {
            label: 'Live Bar',
            icon: Wine,
            path: '/admin/bar',
        },
        {
            label: 'Live Bills',
            icon: Receipt,
            path: '/admin/live-bills',
        },
        {
            label: 'TPV (Manual Order)',
            icon: Monitor,
            path: '/admin/tpv',
        },
        {
            label: 'Printers',
            icon: Printer,
            path: '/admin/printers',
        },
        {
            label: 'Menu Management',
            icon: MenuSquare,
            path: '/admin/menu',
        },
        {
            label: 'Accounts',
            icon: BarChart3,
            path: '/admin/accounts',
        },
        {
            label: 'Past Bills',
            icon: Receipt,
            path: '/admin/bills',
        },
        {
            label: 'QR Codes',
            icon: QrCode,
            path: '/admin/qr-codes',
        },
    ];

    const SidebarContent = () => (
        <div className="h-full flex flex-col">
            <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-muted-foreground">Logged in as</p>
                <p className="font-medium truncate">{userData?.name || userData?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
            </div>

            <nav className="space-y-2 flex-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
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
