import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import type { Table } from '@/types';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Download, QrCode as QrCodeIcon } from 'lucide-react';

export default function QRCodePage() {
    const { restaurantId } = useAuth();
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [layoutConfigured, setLayoutConfigured] = useState(false);
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (restaurantId) {
            checkLayoutAndLoadTables();
        }
    }, [restaurantId]);

    useEffect(() => {
        if (selectedTable) {
            generateQRCode(selectedTable);
        }
    }, [selectedTable]);

    const checkLayoutAndLoadTables = async () => {
        if (!restaurantId) return;

        try {
            // Check if layout is configured
            const restaurantDoc = await getDoc(firestoreDoc(db, 'restaurants', restaurantId));
            const configured = restaurantDoc.exists() && restaurantDoc.data()?.layoutConfigured;
            setLayoutConfigured(configured);

            if (configured) {
                // Load tables
                const tablesRef = collection(db, 'tables');
                const q = query(tablesRef, where('restaurantId', '==', restaurantId), where('isActive', '==', true));
                const querySnapshot = await getDocs(q);

                const loadedTables: Table[] = [];
                querySnapshot.forEach((doc) => {
                    loadedTables.push({ id: doc.id, ...doc.data() } as Table);
                });

                setTables(loadedTables);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateQRCode = async (table: Table) => {
        try {
            const url = `${window.location.origin}/order?table=${encodeURIComponent(table.name)}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });
            setQrCodeUrl(dataUrl);
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    };

    const downloadQRCode = async (table: Table) => {
        try {
            const url = `${window.location.origin}/order?table=${encodeURIComponent(table.name)}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 800,
                margin: 2,
            });

            const link = document.createElement('a');
            link.download = `${table.name}-qr-code.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error downloading QR code:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!layoutConfigured || tables.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>No Tables Configured</CardTitle>
                        <CardDescription>
                            {!layoutConfigured
                                ? 'Please configure your table layout first before generating QR codes.'
                                : 'No tables found in your layout. Please add tables to generate QR codes.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => (window.location.href = '/admin/layout')}>
                            Go to Table Layout
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Table QR Codes</h1>
                <div className="text-sm text-muted-foreground">
                    {tables.length} {tables.length === 1 ? 'table' : 'tables'}
                </div>
            </div>

            <div className="grid gap-4">
                {tables.map((table) => (
                    <QRCodeCard
                        key={table.id}
                        table={table}
                        onViewQR={() => setSelectedTable(table)}
                        onDownloadQR={() => downloadQRCode(table)}
                    />
                ))}
            </div>

            {/* QR Code Modal */}
            <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCodeIcon className="h-5 w-5" />
                            {selectedTable?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTable?.seats} {selectedTable?.seats === 1 ? 'seat' : 'seats'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-center py-4">
                        {qrCodeUrl && (
                            <img src={qrCodeUrl} alt="QR Code" className="w-full max-w-sm rounded-lg border" />
                        )}
                    </div>

                    <DialogFooter className="sm:justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedTable(null)}
                        >
                            Close
                        </Button>
                        <Button
                            onClick={() => selectedTable && downloadQRCode(selectedTable)}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download PNG
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface QRCodeCardProps {
    table: Table;
    onViewQR: () => void;
    onDownloadQR: () => void;
}

function QRCodeCard({ table, onViewQR, onDownloadQR }: QRCodeCardProps) {
    const [qrPreview, setQrPreview] = useState('');

    useEffect(() => {
        const generatePreview = async () => {
            try {
                const url = `${window.location.origin}/order?table=${encodeURIComponent(table.name)}`;
                const dataUrl = await QRCode.toDataURL(url, {
                    width: 150,
                    margin: 1,
                });
                setQrPreview(dataUrl);
            } catch (error) {
                console.error('Error generating QR preview:', error);
            }
        };

        generatePreview();
    }, [table]);

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-center gap-6">
                    <div className="relative group cursor-pointer" onClick={onViewQR}>
                        <div className="w-32 h-32 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
                            {qrPreview && (
                                <>
                                    <img
                                        src={qrPreview}
                                        alt="QR Code Preview"
                                        className="w-full h-full object-cover blur-sm group-hover:blur-none transition-all"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/0 transition-colors">
                                        <span className="text-white text-sm font-medium group-hover:opacity-0 transition-opacity">
                                            Click to view
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-xl font-semibold">{table.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {table.seats} {table.seats === 1 ? 'seat' : 'seats'}
                        </p>
                    </div>

                    <Button onClick={onDownloadQR} size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
