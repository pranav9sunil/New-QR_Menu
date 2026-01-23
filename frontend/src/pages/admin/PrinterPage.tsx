import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Plus, Trash2, Save, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { PrinterDevice } from '@/types';
import { toast } from 'sonner';

export default function PrinterPage() {
    const { restaurantId } = useAuth();
    const [printers, setPrinters] = useState<PrinterDevice[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newPrinter, setNewPrinter] = useState({ name: '', type: 'kitchen', ipAddress: '', port: '9100' });

    useEffect(() => {
        if (restaurantId) {
            loadPrinters();
        }
    }, [restaurantId]);

    const loadPrinters = async () => {
        if (!restaurantId) return;
        try {
            const docRef = doc(db, 'restaurants', restaurantId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPrinters(data.printers || []);
            }
        } catch (error) {
            console.error('Error loading printers:', error);
            toast.error('Failed to load printers');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPrinter = async () => {
        if (!newPrinter.name || !newPrinter.ipAddress || !newPrinter.port || !restaurantId) {
            toast.error('Please fill in all fields');
            return;
        }

        const printer: PrinterDevice = {
            id: Date.now().toString(),
            name: newPrinter.name,
            type: newPrinter.type as 'kitchen' | 'bar' | 'receipt',
            ipAddress: newPrinter.ipAddress,
            port: newPrinter.port,
            status: 'offline' // Default to offline
        };

        try {
            const docRef = doc(db, 'restaurants', restaurantId);
            await updateDoc(docRef, {
                printers: arrayUnion(printer)
            });
            setPrinters([...printers, printer]);
            setIsAdding(false);
            setNewPrinter({ name: '', type: 'kitchen', ipAddress: '', port: '9100' });
            toast.success('Printer added successfully');
        } catch (error) {
            console.error('Error adding printer:', error);
            toast.error('Failed to save printer');
        }
    };

    const handleDeletePrinter = async (id: string) => {
        if (!restaurantId) return;
        try {
            const updatedPrinters = printers.filter(p => p.id !== id);
            const docRef = doc(db, 'restaurants', restaurantId);
            await updateDoc(docRef, {
                printers: updatedPrinters
            });
            setPrinters(updatedPrinters);
            toast.success('Printer removed');
        } catch (error) {
            console.error('Error removing printer:', error);
            toast.error('Failed to remove printer');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading printers...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Printer className="h-8 w-8" />
                    Printer Management
                </h1>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Printer
                </Button>
            </div>

            {isAdding && (
                <Card className="border-2 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Printer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Printer Name</Label>
                                <Input
                                    placeholder="e.g. Main Kitchen"
                                    value={newPrinter.name}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newPrinter.type}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, type: e.target.value })}
                                >
                                    <option value="kitchen">Kitchen Printer</option>
                                    <option value="bar">Bar Printer</option>
                                    <option value="receipt">Receipt Printer</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>IP Address</Label>
                                <Input
                                    placeholder="e.g. 192.168.1.100"
                                    value={newPrinter.ipAddress}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, ipAddress: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Port</Label>
                                <Input
                                    placeholder="e.g. 9100"
                                    value={newPrinter.port}
                                    onChange={(e) => setNewPrinter({ ...newPrinter, port: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                            <Button onClick={handleAddPrinter}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Printer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {printers.length === 0 && !isAdding && (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                        <Printer className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No printers configured yet.</p>
                        <Button variant="link" onClick={() => setIsAdding(true)}>Add your first printer</Button>
                    </div>
                )}

                {printers.map((printer) => (
                    <Card key={printer.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <Printer className="h-5 w-5 text-muted-foreground" />
                                {printer.name}
                            </CardTitle>
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${printer.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {printer.status === 'online' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {printer.status.toUpperCase()}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm mt-3">
                                <div className="grid grid-cols-3 text-muted-foreground">
                                    <span>Type:</span>
                                    <span className="col-span-2 font-medium capitalize text-foreground">{printer.type}</span>
                                </div>
                                <div className="grid grid-cols-3 text-muted-foreground">
                                    <span>IP:</span>
                                    <span className="col-span-2 font-medium text-foreground">{printer.ipAddress}</span>
                                </div>
                                <div className="grid grid-cols-3 text-muted-foreground">
                                    <span>Port:</span>
                                    <span className="col-span-2 font-medium text-foreground">{printer.port || '9100'}</span>
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button variant="outline" size="sm" className="w-full" onClick={() => {
                                    // Dummy order for testing
                                    const dummySession: any = { tableName: 'Test Table' };
                                    const dummyItems: any[] = [{ name: 'Test Item', quantity: 1, price: 0, notes: 'Connection Test' }];
                                    import('@/utils/receiptGenerator').then(({ printReceipt }) => {
                                        printReceipt(dummySession, dummyItems, `TEST PRINT: ${printer.name}`);
                                    });
                                }}>
                                    Test Print
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleDeletePrinter(printer.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
