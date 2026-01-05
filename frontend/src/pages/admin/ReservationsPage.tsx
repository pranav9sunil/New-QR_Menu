import { useEffect, useState } from 'react';
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
    doc,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import type { Reservation, Table } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Edit2, Calendar, Phone, User, Clock, Filter } from 'lucide-react';

export default function ReservationsPage() {
    const { restaurantId } = useAuth();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

    // Form state
    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [reservationDate, setReservationDate] = useState('');
    const [reservationTime, setReservationTime] = useState('');
    const [selectedTableId, setSelectedTableId] = useState<string>('none');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled' | 'completed'>('pending');

    // Filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Load tables
    useEffect(() => {
        if (!restaurantId) return;

        const loadTables = async () => {
            const tablesRef = collection(db, 'tables');
            const q = query(tablesRef, where('restaurantId', '==', restaurantId));
            const snapshot = await getDocs(q);
            const loadedTables: Table[] = [];
            snapshot.forEach((doc) => {
                loadedTables.push({ id: doc.id, ...doc.data() } as Table);
            });
            setTables(loadedTables);
        };

        loadTables();
    }, [restaurantId]);

    // Subscribe to reservations
    useEffect(() => {
        if (!restaurantId) {
            setLoading(false);
            return;
        }

        const reservationsRef = collection(db, 'reservations');
        // Simple query without orderBy to avoid needing composite index
        const q = query(
            reservationsRef,
            where('restaurantId', '==', restaurantId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedReservations: Reservation[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                loadedReservations.push({
                    id: doc.id,
                    ...data,
                    dateTime: data.dateTime?.toDate?.() || new Date(data.dateTime),
                    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                } as Reservation);
            });
            // Sort client-side by dateTime
            loadedReservations.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
            setReservations(loadedReservations);
            setLoading(false);
        }, (error) => {
            console.error('Error loading reservations:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [restaurantId]);

    // Filter reservations by date range
    const filteredReservations = reservations.filter((res) => {
        if (!startDate && !endDate) return true;

        const resDate = new Date(res.dateTime);
        resDate.setHours(0, 0, 0, 0);

        if (startDate && !endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            return resDate >= start;
        }

        if (!startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return resDate <= end;
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return resDate >= start && resDate <= end;
    });

    const resetForm = () => {
        setCustomerName('');
        setPhone('');
        setReservationDate('');
        setReservationTime('');
        setSelectedTableId('none');
        setNotes('');
        setStatus('pending');
        setEditingReservation(null);
    };

    const handleOpenModal = (reservation?: Reservation) => {
        if (reservation) {
            setEditingReservation(reservation);
            setCustomerName(reservation.customerName);
            setPhone(reservation.phone);
            const dt = new Date(reservation.dateTime);
            setReservationDate(dt.toISOString().split('T')[0]);
            setReservationTime(dt.toTimeString().slice(0, 5));
            setSelectedTableId(reservation.tableId || 'none');
            setNotes(reservation.notes || '');
            setStatus(reservation.status);
        } else {
            resetForm();
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!restaurantId || !customerName.trim() || !phone.trim() || !reservationDate || !reservationTime) {
            alert('Please fill in all required fields');
            return;
        }

        const dateTime = new Date(`${reservationDate}T${reservationTime}`);
        const selectedTable = tables.find((t) => t.id === selectedTableId);

        const reservationData = {
            restaurantId,
            customerName: customerName.trim(),
            phone: phone.trim(),
            dateTime: Timestamp.fromDate(dateTime),
            tableId: selectedTableId !== 'none' ? selectedTableId : null,
            tableName: selectedTable?.name || null,
            notes: notes.trim() || null,
            status,
        };

        try {
            if (editingReservation) {
                await updateDoc(doc(db, 'reservations', editingReservation.id), reservationData);
            } else {
                await addDoc(collection(db, 'reservations'), {
                    ...reservationData,
                    createdAt: Timestamp.now(),
                });
            }
            setModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving reservation:', error);
            alert('Failed to save reservation');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this reservation?')) return;

        try {
            await deleteDoc(doc(db, 'reservations', id));
        } catch (error) {
            console.error('Error deleting reservation:', error);
            alert('Failed to delete reservation');
        }
    };

    const formatDateTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

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
                <h1 className="text-3xl font-bold text-gray-800">Reservations</h1>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="border-orange-200"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                    <Button
                        onClick={() => handleOpenModal()}
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Reservation
                    </Button>
                </div>
            </div>

            {/* Date Range Filter */}
            {showFilters && (
                <Card className="border-orange-100">
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <Label htmlFor="startDate">From</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div>
                                <Label htmlFor="endDate">To</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                }}
                            >
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Reservations List */}
            {filteredReservations.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No reservations found</p>
                        {(startDate || endDate) && (
                            <p className="text-sm mt-1">Try adjusting your date filter</p>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReservations.map((reservation) => (
                        <Card key={reservation.id} className="border-orange-100 hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <User className="h-4 w-4 text-orange-500" />
                                        {reservation.customerName}
                                    </CardTitle>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                                        {reservation.status}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="h-4 w-4" />
                                    {reservation.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Clock className="h-4 w-4" />
                                    {formatDateTime(reservation.dateTime)}
                                </div>
                                {reservation.tableName && (
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium">Table:</span> {reservation.tableName}
                                    </div>
                                )}
                                {reservation.notes && (
                                    <div className="text-sm text-gray-500 italic">
                                        "{reservation.notes}"
                                    </div>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenModal(reservation)}
                                        className="flex-1"
                                    >
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(reservation.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Reservation Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingReservation ? 'Edit Reservation' : 'New Reservation'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingReservation
                                ? 'Update the reservation details below.'
                                : 'Fill in the details to create a new reservation.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="customerName">Customer Name *</Label>
                            <Input
                                id="customerName"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <Label htmlFor="phone">Phone Number *</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 234 567 8900"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="date">Date *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={reservationDate}
                                    onChange={(e) => setReservationDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="time">Time *</Label>
                                <Input
                                    id="time"
                                    type="time"
                                    value={reservationTime}
                                    onChange={(e) => setReservationTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="table">Table (Optional)</Label>
                            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a table" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No table assigned</SelectItem>
                                    {tables.map((table) => (
                                        <SelectItem key={table.id} value={table.id}>
                                            {table.name} ({table.seats} seats)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {editingReservation && (
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div>
                            <Label htmlFor="notes">Notes (Optional)</Label>
                            <Input
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Special requests, dietary needs, etc."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                        >
                            {editingReservation ? 'Update' : 'Create'} Reservation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
