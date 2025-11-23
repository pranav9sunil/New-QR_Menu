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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SettingsModal from './SettingsModal';

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
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
            label: 'QR Codes',
            icon: QrCode,
            path: '/admin/qr-codes',
        },
        {
            label: 'Menu Management',
            icon: MenuSquare,
            path: '/admin/menu',
        },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Navbar */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center px-4 gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

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
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside
                    className={cn(
                        'fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 transform border-r bg-background transition-transform duration-200 ease-in-out',
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                        'md:translate-x-0'
                    )}
                >
                    <div className="p-4">
                        <div className="mb-4 pb-4 border-b">
                            <p className="text-sm text-muted-foreground">Logged in as</p>
                            <p className="font-medium truncate">{userData?.name || userData?.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{userData?.role}</p>
                        </div>

                        <nav className="space-y-2">
                            {menuItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <Link
                                to="/admin/bills"
                                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100"
                            >
                                <Receipt className="h-5 w-5" />
                                Past Bills
                            </Link>
                        </nav>
                    </div>
                </aside>

                {/* Main Content */}
                <main
                    className={cn(
                        'flex-1 transition-all duration-200 ease-in-out p-6',
                        sidebarOpen ? 'md:ml-64' : 'ml-0'
                    )}
                >
                    <Outlet />
                </main>
            </div>

            {/* Settings Modal */}
            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
