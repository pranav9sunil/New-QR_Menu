
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    onSnapshot
} from 'firebase/firestore';
import type { MenuItem, CartItem, CustomizationOption, Table, Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
    Search,
    Plus,
    Minus,
    PenLine,
    Utensils,
    Coffee,
    Beer,
    IceCream,
    Sandwich,
    Pizza,
    ChefHat,

    Check
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming Sheet component exists or I'll use Dialog for mobile cart

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, any> = {
    'starters': Utensils,
    'main course': ChefHat,
    'burgers': Sandwich,
    'pizza': Pizza,
    'drinks': Coffee,
    'alcohol': Beer,
    'desserts': IceCream,
    'default': Utensils
};

export default function TPVPage() {
    const { restaurantId } = useAuth();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    // const [loading, setLoading] = useState(true);

    // Table Selection
    const [tables, setTables] = useState<Table[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

    // Customization Modal
    const [customizationModalOpen, setCustomizationModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [customizationSelections, setCustomizationSelections] = useState<Record<string, CustomizationOption[]>>({});
    const [itemNotes, setItemNotes] = useState('');

    // Note Modal
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
    const [currentNote, setCurrentNote] = useState('');

    // Previous Orders (from active session)
    const [previousOrders, setPreviousOrders] = useState<Order[]>([]);

    // Mobile Cart Sheet


    useEffect(() => {
        if (!restaurantId) return;
        loadData();
    }, [restaurantId]);

    const loadData = async () => {
        // setLoading(true);
        try {
            // Load Menu Items
            const menuRef = collection(db, 'menu_items');
            const menuQuery = query(menuRef, where('restaurantId', '==', restaurantId), where('isAvailable', '==', true));
            const menuSnapshot = await getDocs(menuQuery);
            const items: MenuItem[] = [];
            menuSnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MenuItem);
            });
            setMenuItems(items);

            // Extract Categories
            const cats = Array.from(new Set(items.map(i => i.category))).sort();
            setCategories(cats);
            if (cats.length > 0) setSelectedCategory(cats[0]);

            // Load Tables
            const tablesRef = collection(db, 'tables');
            const tablesQuery = query(tablesRef, where('restaurantId', '==', restaurantId));
            const tablesSnapshot = await getDocs(tablesQuery);
            const loadedTables: Table[] = [];
            tablesSnapshot.forEach((doc) => {
                loadedTables.push({ id: doc.id, ...doc.data() } as Table);
            });
            setTables(loadedTables.sort((a, b) => a.name.localeCompare(b.name)));

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            // setLoading(false);
        }
    };

    // Subscribe to previous orders when table is selected
    useEffect(() => {
        if (!selectedTableId || !restaurantId) {
            setPreviousOrders([]);
            return;
        }

        // First, find active session for this table
        const sessionsRef = collection(db, 'sessions');
        const sessionQuery = query(
            sessionsRef,
            where('tableId', '==', selectedTableId),
            where('status', 'in', ['active', 'payment_pending'])
        );

        const unsubscribeSession = onSnapshot(sessionQuery, async (sessionSnapshot) => {
            if (sessionSnapshot.empty) {
                setPreviousOrders([]);
                return;
            }

            const sessionId = sessionSnapshot.docs[0].id;

            // Subscribe to orders for this session
            const ordersRef = collection(db, 'orders');
            const ordersQuery = query(
                ordersRef,
                where('sessionId', '==', sessionId)
            );

            const unsubscribeOrders = onSnapshot(ordersQuery, (ordersSnapshot) => {
                const orders: Order[] = [];
                ordersSnapshot.forEach((doc) => {
                    orders.push({ id: doc.id, ...doc.data() } as Order);
                });
                // Sort by creation time (newest first)
                orders.sort((a, b) => {
                    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() || 0;
                    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() || 0;
                    return bTime - aTime;
                });
                setPreviousOrders(orders);
            });

            return () => unsubscribeOrders();
        });

        return () => unsubscribeSession();
    }, [selectedTableId, restaurantId]);

    const handleAddToCart = (item: MenuItem) => {
        if (item.customizationOptions && item.customizationOptions.length > 0) {
            setSelectedItem(item);
            setCustomizationSelections({});
            setItemNotes('');
            setCustomizationModalOpen(true);
        } else {
            addItemToCart(item);
        }
    };

    const addItemToCart = (item: MenuItem | CartItem) => {
        const newItem = { ...item, quantity: 1 } as CartItem;

        // Check if identical item exists (same id and customizations)
        const existingIndex = cart.findIndex(cartItem =>
            cartItem.id === item.id &&
            JSON.stringify(cartItem.selectedCustomizations) === JSON.stringify((item as CartItem).selectedCustomizations) &&
            cartItem.notes === (item as CartItem).notes
        );

        if (existingIndex >= 0) {
            const newCart = [...cart];
            newCart[existingIndex].quantity += 1;
            setCart(newCart);
        } else {
            setCart([...cart, newItem]);
        }
    };

    const handleConfirmCustomization = () => {
        if (!selectedItem) return;

        const customPrice = selectedItem.price + Object.values(customizationSelections).flat().reduce((sum, opt) => sum + opt.price, 0);

        const customItem: CartItem = {
            ...selectedItem,
            quantity: 1,
            selectedCustomizations: customizationSelections,
            notes: itemNotes,
            price: customPrice
        };

        addItemToCart(customItem);
        setCustomizationModalOpen(false);
        setSelectedItem(null);
    };

    const updateQuantity = (index: number, change: number) => {
        const newCart = [...cart];
        newCart[index].quantity += change;
        if (newCart[index].quantity <= 0) {
            newCart.splice(index, 1);
        }
        setCart(newCart);
    };

    const openNoteModal = (index: number) => {
        setEditingCartItemIndex(index);
        setCurrentNote(cart[index].notes || '');
        setNoteModalOpen(true);
    };

    const saveNote = () => {
        if (editingCartItemIndex === null) return;
        const newCart = [...cart];
        newCart[editingCartItemIndex].notes = currentNote;
        setCart(newCart);
        setNoteModalOpen(false);
        setEditingCartItemIndex(null);
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const handlePlaceOrder = async () => {
        if (!selectedTableId) {
            toast.error('Please select a table first');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        try {
            const table = tables.find(t => t.id === selectedTableId);
            if (!table) return;

            // Check for active session or create one
            const sessionsRef = collection(db, 'sessions');
            const qSession = query(
                sessionsRef,
                where('tableId', '==', selectedTableId),
                where('status', 'in', ['active', 'payment_pending'])
            );
            const sessionSnap = await getDocs(qSession);

            let sessionId;
            if (sessionSnap.empty) {
                // Create new session
                const sessionData = {
                    restaurantId,
                    tableId: selectedTableId,
                    tableName: table.name,
                    code: Math.floor(Math.random() * 90 + 10).toString(),
                    status: 'active',
                    createdAt: serverTimestamp(),
                    totalAmount: 0,
                };
                const docRef = await addDoc(collection(db, 'sessions'), sessionData);
                sessionId = docRef.id;
            } else {
                sessionId = sessionSnap.docs[0].id;
                // If session was payment_pending, reset to active
                if (sessionSnap.docs[0].data().status === 'payment_pending') {
                    await updateDoc(doc(db, 'sessions', sessionId), {
                        status: 'active',
                        tipAmount: 0,
                        tipPercentage: null
                    });
                }
            }

            // Create Order
            const subtotal = calculateTotal();
            const tax = subtotal * 0.08; // Assuming 8% tax
            const total = subtotal + tax;

            const order = {
                restaurantId,
                tableId: selectedTableId,
                tableName: table.name,
                sessionId,
                items: cart.map(item => ({
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    category: item.category || 'default',
                    selectedCustomizations: item.selectedCustomizations ?
                        Object.values(item.selectedCustomizations).flat().map(opt => ({ name: opt.name, price: opt.price })) : [],
                    notes: item.notes || ''
                })),
                status: 'pending',
                subtotal,
                tax,
                total,
                createdAt: serverTimestamp(),
                manualOrder: true
            };

            await addDoc(collection(db, 'orders'), order);

            toast.success('Order placed successfully!');
            setCart([]);
            setSelectedTableId(null);

        } catch (error) {
            console.error('Error placing order:', error);
            toast.error('Failed to place order');
        }
    };

    const filteredItems = menuItems.filter(item =>
        (selectedCategory ? item.category === selectedCategory : true) &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const CartContent = () => (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border">
            {/* Table Selector Header */}
            <div className="p-3 border-b bg-gray-50">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Select Table</Label>
                <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={selectedTableId || ''}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                >
                    <option value="">-- Select Table --</option>
                    {tables.map(table => (
                        <option key={table.id} value={table.id}>{table.name}</option>
                    ))}
                </select>
            </div>

            {/* Cart Items - Current Order (Light Green) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {cart.length === 0 && previousOrders.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>No items added</p>
                    </div>
                ) : (
                    <>
                        {/* Current Order Items */}
                        {cart.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-green-700 uppercase tracking-wider">Current Order</div>
                                {cart.map((item, index) => (
                                    <div key={index} className="flex flex-col gap-1 pb-2 border-b last:border-0 bg-green-50 rounded-lg p-2">
                                        <div className="flex justify-between items-start w-full">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-medium text-sm truncate">{item.name}</div>
                                                <div className="text-[10px] text-muted-foreground leading-tight">
                                                    €{item.price.toFixed(2)}
                                                    {item.selectedCustomizations && Object.values(item.selectedCustomizations).flat().length > 0 && (
                                                        <span className="ml-1">
                                                            (+{Object.values(item.selectedCustomizations).flat().map(opt => opt.name).join(', ')})
                                                        </span>
                                                    )}
                                                </div>
                                                {item.notes && (
                                                    <div className="text-[10px] bg-yellow-50 text-yellow-800 p-0.5 rounded mt-0.5 flex items-start gap-1 inline-block">
                                                        <PenLine className="h-2.5 w-2.5 mt-0.5 inline" />
                                                        {item.notes}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 self-start mt-0.5">
                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-1 bg-white rounded-md h-6 px-1">
                                                    <button onClick={() => updateQuantity(index, -1)} className="p-0.5 hover:bg-gray-100 rounded transition-colors">
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="font-medium w-4 text-center text-[10px]">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(index, 1)} className="p-0.5 hover:bg-gray-100 rounded transition-colors">
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>

                                                {/* Total Price */}
                                                <div className="font-bold text-sm w-14 text-right">
                                                    €{(item.price * item.quantity).toFixed(2)}
                                                </div>

                                                {/* Note Button */}
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNoteModal(index)} title="Add Note">
                                                    <PenLine className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Divider between current and previous orders */}
                        {cart.length > 0 && previousOrders.length > 0 && (
                            <div className="border-t border-gray-300 my-3" />
                        )}

                        {/* Previous Orders (Pale Red) - Consolidated */}
                        {previousOrders.length > 0 && (() => {
                            // Consolidate all items from all orders
                            const consolidatedItems: { name: string; price: number; quantity: number; notes?: string; customizations?: string }[] = [];

                            previousOrders.forEach(order => {
                                order.items.forEach(item => {
                                    const customizationsKey = item.selectedCustomizations?.map(c => c.name).sort().join(',') || '';
                                    const existingIndex = consolidatedItems.findIndex(
                                        ci => ci.name === item.name && ci.price === item.price && ci.customizations === customizationsKey
                                    );

                                    if (existingIndex >= 0) {
                                        consolidatedItems[existingIndex].quantity += item.quantity;
                                    } else {
                                        consolidatedItems.push({
                                            name: item.name,
                                            price: item.price,
                                            quantity: item.quantity,
                                            notes: item.notes,
                                            customizations: customizationsKey
                                        });
                                    }
                                });
                            });

                            return (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-red-700 uppercase tracking-wider">Previous Orders</div>
                                    {consolidatedItems.map((item, index) => (
                                        <div key={index} className="flex flex-col gap-1 pb-2 border-b last:border-0 bg-red-50 rounded-lg p-2">
                                            <div className="flex justify-between items-start w-full">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="font-medium text-sm truncate text-red-900">{item.name}</div>
                                                    <div className="text-[10px] text-red-700 leading-tight">
                                                        €{item.price.toFixed(2)} × {item.quantity}
                                                        {item.customizations && (
                                                            <span className="ml-1">
                                                                (+{item.customizations})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.notes && (
                                                        <div className="text-[10px] bg-yellow-50 text-yellow-800 p-0.5 rounded mt-0.5 flex items-start gap-1 inline-block">
                                                            <PenLine className="h-2.5 w-2.5 mt-0.5 inline" />
                                                            {item.notes}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-bold text-sm w-14 text-right text-red-900">
                                                    €{(item.price * item.quantity).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t mt-auto">
                <div className="flex justify-between items-center mb-3 text-base font-bold">
                    <span>Total</span>
                    <span>€{calculateTotal().toFixed(2)}</span>
                </div>
                <Button
                    className="w-full h-10 text-base"
                    onClick={handlePlaceOrder}
                    disabled={cart.length === 0 || !selectedTableId}
                >
                    Place Order
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4 relative overflow-hidden">
            {/* Left Side: Menu */}
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                {/* Header / Search */}
                <div className="flex items-center gap-4 bg-white p-3 rounded-lg shadow-sm flex-none">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search menu items..."
                            className="pl-9 h-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Categories */}
                <div className="w-full overflow-x-auto whitespace-nowrap bg-white p-2 rounded-lg shadow-sm flex-none">
                    <div className="flex gap-2 pb-2">
                        {categories.map(cat => {
                            const Icon = CATEGORY_ICONS[cat.toLowerCase()] || CATEGORY_ICONS['default'];
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        flex flex-col items-center justify-center min-w-[5rem] w-20 h-20 p-1.5 rounded-xl border-2 transition-all shrink-0
                                        ${selectedCategory === cat
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600'}
                                    `}
                                >
                                    <Icon className="h-5 w-5 mb-1.5 shrink-0" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-center leading-tight whitespace-normal line-clamp-2 w-full">
                                        {cat}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="flex-1 overflow-y-auto bg-white p-4 rounded-lg shadow-sm">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                        {filteredItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleAddToCart(item)}
                                className="relative flex flex-col items-center p-2 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-center h-full bg-white shadow-sm"
                            >
                                {item.customizationOptions && item.customizationOptions.length > 0 && (
                                    <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full shadow-sm" title="Customizable" />
                                )}
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
                                ) : (
                                    <div className="w-full aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                                        <Utensils className="h-5 w-5 text-gray-400" />
                                    </div>
                                )}
                                <h3 className="font-medium text-[10px] sm:text-xs line-clamp-2 mb-1 w-full leading-tight">{item.name}</h3>
                                <p className="text-[10px] sm:text-xs text-primary font-bold mt-auto">€{item.price.toFixed(2)}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side: Order Summary */}
            {/* On mobile/tablet: Fixed height at bottom. On Desktop: Full height sidebar */}
            <div className="w-full lg:w-96 flex-none h-[40vh] lg:h-full">
                <CartContent />
            </div>



            {/* Customization Modal */}
            <Dialog open={customizationModalOpen} onOpenChange={setCustomizationModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Customize {selectedItem?.name}</DialogTitle>
                    </DialogHeader>

                    {selectedItem?.customizationOptions?.map((group) => (
                        <div key={group.id} className="space-y-3 py-4 border-b last:border-0">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-semibold">
                                    {group.name}
                                    {group.minSelection && group.minSelection > 0 && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                    {group.type === 'single' ? 'Select 1' : `Select up to ${group.maxSelection || 'any'} `}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.options.map((option) => {
                                    const isSelected = customizationSelections[group.id]?.some(opt => opt.name === option.name);
                                    return (
                                        <div
                                            key={option.name}
                                            className={`
                                                flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all relative overflow-hidden
                                                ${isSelected
                                                    ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600 shadow-sm'
                                                    : 'hover:border-gray-300 hover:bg-gray-50'}
                                            `}
                                            onClick={() => {
                                                const current = customizationSelections[group.id] || [];
                                                if (group.type === 'single') {
                                                    setCustomizationSelections({
                                                        ...customizationSelections,
                                                        [group.id]: [option]
                                                    });
                                                } else {
                                                    if (isSelected) {
                                                        setCustomizationSelections({
                                                            ...customizationSelections,
                                                            [group.id]: current.filter(opt => opt.name !== option.name)
                                                        });
                                                    } else {
                                                        if (group.maxSelection && current.length >= group.maxSelection) return;
                                                        setCustomizationSelections({
                                                            ...customizationSelections,
                                                            [group.id]: [...current, option]
                                                        });
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isSelected && <Check className="h-4 w-4 text-orange-600" />}
                                                <span className={`font-medium ${isSelected ? 'text-orange-700' : 'text-gray-700'}`}>{option.name}</span>
                                            </div>
                                            {option.price > 0 && (
                                                <span className={`text-sm ${isSelected ? 'text-orange-600 font-bold' : 'text-muted-foreground'}`}>+€{option.price.toFixed(2)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setCustomizationModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmCustomization}>Add to Order</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Note Modal */}
            <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Note</DialogTitle>
                        <DialogDescription>Add special instructions for this item</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={currentNote}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentNote(e.target.value)}
                        placeholder="e.g., No onions, extra spicy..."
                        className="min-h-[100px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
                        <Button onClick={saveNote}>Save Note</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
