import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Plus, Trash2, Save } from 'lucide-react';

interface PrinterDevice {
    id: string;
    name: string;
    type: 'kitchen' | 'bar' | 'receipt';
    ipAddress: string;
    status: 'online' | 'offline';
}

export default function PrinterPage() {
    const [printers, setPrinters] = useState<PrinterDevice[]>([
        { id: '1', name: 'Kitchen Printer 1', type: 'kitchen', ipAddress: '192.168.1.101', status: 'online' },
        { id: '2', name: 'Bar Printer', type: 'bar', ipAddress: '192.168.1.102', status: 'offline' },
    ]);
    const [isAdding, setIsAdding] = useState(false);
    const [newPrinter, setNewPrinter] = useState({ name: '', type: 'kitchen', ipAddress: '' });

    const handleAddPrinter = () => {
        if (!newPrinter.name || !newPrinter.ipAddress) return;

        const printer: PrinterDevice = {
            id: Date.now().toString(),
            name: newPrinter.name,
            type: newPrinter.type as 'kitchen' | 'bar' | 'receipt',
            ipAddress: newPrinter.ipAddress,
            status: 'offline' // Default to offline until connected
        };

        setPrinters([...printers, printer]);
        setIsAdding(false);
        setNewPrinter({ name: '', type: 'kitchen', ipAddress: '' });
    };

    const handleDeletePrinter = (id: string) => {
        setPrinters(printers.filter(p => p.id !== id));
    };

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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {printers.map((printer) => (
                    <Card key={printer.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-lg font-medium">
                                {printer.name}
                            </CardTitle>
                            <div className={`h-2 w-2 rounded-full ${printer.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Type:</span>
                                    <span className="font-medium capitalize text-foreground">{printer.type}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>IP Address:</span>
                                    <span className="font-medium text-foreground">{printer.ipAddress}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <span className={`font-medium ${printer.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                                        {printer.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button variant="outline" size="sm" className="w-full">
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
