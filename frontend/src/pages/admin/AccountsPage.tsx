import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { TableSession, Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { DollarSign, ShoppingBag, Clock, TrendingUp } from 'lucide-react';

export default function AccountsPage() {
    const { restaurantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'day' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        avgCompletionTime: 0, // in minutes
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [bestSellers, setBestSellers] = useState<any[]>([]);

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId, filterType, selectedDate, selectedMonth]);

    const getDateRange = () => {
        let start: Date, end: Date;

        if (filterType === 'day') {
            const [year, month, day] = selectedDate.split('-').map(Number);
            start = new Date(year, month - 1, day, 0, 0, 0, 0);
            end = new Date(year, month - 1, day, 23, 59, 59, 999);
        } else {
            const [year, month] = selectedMonth.split('-').map(Number);
            start = new Date(year, month - 1, 1, 0, 0, 0, 0);
            end = new Date(year, month, 0, 23, 59, 59, 999);
        }
        return { start, end };
    };

    const loadData = async () => {
        if (!restaurantId) return;
        setLoading(true);

        try {
            const { start, end } = getDateRange();
            let sessions: TableSession[] = [];
            let orders: Order[] = [];

            // Fetch Sessions
            const sessionsRef = collection(db, 'sessions');
            try {
                // Try optimized query (needs index)
                const sessionsQuery = query(
                    sessionsRef,
                    where('restaurantId', '==', restaurantId),
                    where('createdAt', '>=', start),
                    where('createdAt', '<=', end)
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                sessionsSnapshot.forEach((doc) => {
                    sessions.push({ id: doc.id, ...doc.data() } as TableSession);
                });
            } catch (indexError) {
                console.warn("Session query failed (likely missing index), falling back to client-side filtering", indexError);
                // Fallback: Fetch all for restaurant (or limit to recent if possible, but for stats we need accuracy)
                // For now, fetch all. In production, we'd want to limit or ensure index exists.
                const fallbackQuery = query(
                    sessionsRef,
                    where('restaurantId', '==', restaurantId)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                fallbackSnapshot.forEach((doc) => {
                    const data = doc.data() as TableSession;
                    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);
                    if (createdAt >= start && createdAt <= end) {
                        sessions.push({ ...data, id: doc.id } as TableSession);
                    }
                });
            }

            // Fetch Orders
            const ordersRef = collection(db, 'orders');
            try {
                // Try optimized query (needs index)
                const ordersQuery = query(
                    ordersRef,
                    where('restaurantId', '==', restaurantId),
                    where('createdAt', '>=', start),
                    where('createdAt', '<=', end)
                );
                const ordersSnapshot = await getDocs(ordersQuery);
                ordersSnapshot.forEach((doc) => {
                    orders.push({ id: doc.id, ...doc.data() } as Order);
                });
            } catch (indexError) {
                console.warn("Order query failed (likely missing index), falling back to client-side filtering", indexError);
                const fallbackQuery = query(
                    ordersRef,
                    where('restaurantId', '==', restaurantId)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                fallbackSnapshot.forEach((doc) => {
                    const data = doc.data() as Order;
                    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt);
                    if (createdAt >= start && createdAt <= end) {
                        orders.push({ ...data, id: doc.id } as Order);
                    }
                });
            }

            processStats(sessions, orders, end);

        } catch (error) {
            console.error("Error loading accounts data:", error);
        } finally {
            setLoading(false);
        }
    };

    const processStats = (sessions: TableSession[], orders: Order[], end: Date) => {
        // 1. Basic Stats
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalOrders = sessions.length; // "If a table makes 5 orders, count it as 1 order" -> Count sessions

        // 2. Avg Completion Time
        let totalTime = 0;
        let timeCount = 0;

        // Group orders by session
        const ordersBySession: Record<string, Order[]> = {};
        orders.forEach(o => {
            if (o.sessionId) {
                if (!ordersBySession[o.sessionId]) ordersBySession[o.sessionId] = [];
                ordersBySession[o.sessionId].push(o);
            }
        });

        sessions.forEach(s => {
            if (s.status === 'closed' && s.closedAt) {
                const sessionOrders = ordersBySession[s.id];
                if (sessionOrders && sessionOrders.length > 0) {
                    // Find first order time
                    const firstOrderTime = sessionOrders.reduce((min, o) => {
                        const t = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
                        return t < min ? t : min;
                    }, new Date(8640000000000000)); // Max date

                    const closedAt = s.closedAt instanceof Timestamp ? s.closedAt.toDate() : new Date(s.closedAt);

                    const diffMinutes = (closedAt.getTime() - firstOrderTime.getTime()) / (1000 * 60);
                    if (diffMinutes > 0) { // Sanity check
                        totalTime += diffMinutes;
                        timeCount++;
                    }
                }
            }
        });

        const avgCompletionTime = timeCount > 0 ? Math.round(totalTime / timeCount) : 0;

        setStats({
            totalRevenue,
            totalOrders,
            avgCompletionTime
        });

        // 3. Charts Data
        const chartDataMap: Record<string, { name: string, orders: number, sales: number }> = {};

        if (filterType === 'day') {
            // Initialize hours 0-23
            for (let i = 0; i < 24; i++) {
                const label = `${i}:00`;
                chartDataMap[i] = { name: label, orders: 0, sales: 0 };
            }

            sessions.forEach(s => {
                const d = s.createdAt instanceof Timestamp ? s.createdAt.toDate() : new Date(s.createdAt);
                const hour = d.getHours();
                if (chartDataMap[hour]) {
                    chartDataMap[hour].orders += 1;
                }
            });

            orders.forEach(o => {
                const d = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
                const hour = d.getHours();
                if (chartDataMap[hour]) {
                    chartDataMap[hour].sales += (o.total || 0);
                }
            });
        } else {
            // Initialize days of month
            const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                chartDataMap[i] = { name: `${i}`, orders: 0, sales: 0 };
            }

            sessions.forEach(s => {
                const d = s.createdAt instanceof Timestamp ? s.createdAt.toDate() : new Date(s.createdAt);
                const day = d.getDate();
                if (chartDataMap[day]) {
                    chartDataMap[day].orders += 1;
                }
            });

            orders.forEach(o => {
                const d = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
                const day = d.getDate();
                if (chartDataMap[day]) {
                    chartDataMap[day].sales += (o.total || 0);
                }
            });
        }

        setChartData(Object.values(chartDataMap));

        // 4. Best Sellers
        const itemMap: Record<string, { name: string, quantity: number, revenue: number }> = {};

        orders.forEach(o => {
            o.items.forEach(item => {
                if (!itemMap[item.menuItemId]) {
                    itemMap[item.menuItemId] = { name: item.name, quantity: 0, revenue: 0 };
                }
                itemMap[item.menuItemId].quantity += item.quantity;
                itemMap[item.menuItemId].revenue += item.price * item.quantity;
            });
        });

        const sortedBestSellers = Object.values(itemMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10); // Top 10

        setBestSellers(sortedBestSellers);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold">Accounts & Analytics</h1>

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
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">€{stats.totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Collected in selected period
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                        <p className="text-xs text-muted-foreground">
                            Total sessions/bills
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Completion Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgCompletionTime} min</div>
                        <p className="text-xs text-muted-foreground">
                            First order to payment
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Orders per {filterType === 'day' ? 'Hour' : 'Day'}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Orders" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis />
                                <Tooltip formatter={(value: number) => [`€${value.toFixed(2)}`, 'Sales']} />
                                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} name="Sales" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Best Sellers */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Best Selling Dishes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 font-medium text-muted-foreground">Item Name</th>
                                    <th className="text-right py-3 font-medium text-muted-foreground">Quantity Sold</th>
                                    <th className="text-right py-3 font-medium text-muted-foreground">Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bestSellers.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="text-center py-4 text-muted-foreground">
                                            No sales data available
                                        </td>
                                    </tr>
                                ) : (
                                    bestSellers.map((item, index) => (
                                        <tr key={index} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="py-3 font-medium">{item.name}</td>
                                            <td className="text-right py-3">{item.quantity}</td>
                                            <td className="text-right py-3 font-bold text-primary">
                                                €{item.revenue.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
