import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Hash, Armchair } from 'lucide-react';

interface Session {
    id: string;
    tableName: string;
    code: string;
    status: 'active' | 'closed';
    createdAt: any;
}

export default function TableCodesPage() {
    const { restaurantId } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!restaurantId) return;

        const q = query(
            collection(db, 'sessions'),
            where('restaurantId', '==', restaurantId),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activeSessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Session[];

            // Sort by table name naturally (e.g. Table 1, Table 2, Table 10)
            activeSessions.sort((a, b) => {
                return a.tableName.localeCompare(b.tableName, undefined, { numeric: true, sensitivity: 'base' });
            });

            setSessions(activeSessions);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [restaurantId]);

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
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <Hash className="h-8 w-8 text-orange-500" />
                    Table Codes
                </h1>
                <div className="text-sm text-muted-foreground bg-white px-3 py-1 rounded-full border shadow-sm">
                    {sessions.length} Active Tables
                </div>
            </div>

            {sessions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                        <Armchair className="h-16 w-16 text-gray-200" />
                        <p className="text-lg">No active tables at the moment.</p>
                        <p className="text-sm">Codes will appear here when tables are occupied.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {sessions.map((session) => (
                        <Card key={session.id} className="hover:shadow-md transition-shadow border-orange-100 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="bg-orange-50 p-3 border-b border-orange-100 text-center">
                                    <h3 className="font-semibold text-gray-700 truncate" title={session.tableName}>
                                        {session.tableName}
                                    </h3>
                                </div>
                                <div className="p-6 flex flex-col items-center justify-center bg-white min-h-[120px]">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Code</span>
                                    <span className="text-5xl font-bold text-orange-600 tracking-tight">
                                        {session.code}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
