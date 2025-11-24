import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    getDocs,
    addDoc,
    limit,
    where,
    doc,
    updateDoc,
    onSnapshot,
} from 'firebase/firestore';
import type { MenuItem, CartItem, Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat, ShoppingCart, Plus, Minus, Trash2, Receipt, Download, Flame, Info } from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function MenuOrderPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tableName = searchParams.get('table') || 'Unknown Table';

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [restaurantName, setRestaurantName] = useState('Restaurant');
    const [restaurantId, setRestaurantId] = useState('');
    const [taxRate, setTaxRate] = useState(0.08);
    const [cartOpen, setCartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSessionClosed, setIsSessionClosed] = useState(false);
    const [billOrders, setBillOrders] = useState<Order[]>([]);

    useEffect(() => {
        const storedSessionId = localStorage.getItem('sessionId');
        if (!storedSessionId) {
            navigate(`/signup?table=${tableName}`);
            return;
        }
        setSessionId(storedSessionId);
        loadData();

        // Listen for session status changes
        const sessionRef = doc(db, 'sessions', storedSessionId);
        const unsubscribe = onSnapshot(sessionRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.status === 'closed') {
                    // Fetch final orders
                    const ordersRef = collection(db, 'orders');
                    const q = query(ordersRef, where('sessionId', '==', storedSessionId));
                    const snapshot = await getDocs(q);
                    const orders: Order[] = [];
                    snapshot.forEach((doc) => {
                        orders.push({ id: doc.id, ...doc.data() } as Order);
                    });
                    setBillOrders(orders);
                    setIsSessionClosed(true);
                }
            } else {
                // Session deleted?
                localStorage.removeItem('sessionId');
                navigate('/');
            }
        });

        return () => unsubscribe();
    }, [tableName]);

    const loadData = async () => {
        try {
            // Load restaurant info
            const restaurantsRef = collection(db, 'restaurants');
            const restaurantQuery = query(restaurantsRef, limit(1));
            const restaurantSnapshot = await getDocs(restaurantQuery);

            if (!restaurantSnapshot.empty) {
                const restaurantData = restaurantSnapshot.docs[0].data();
                const restId = restaurantSnapshot.docs[0].id;
                setRestaurantName(restaurantData.name || 'Restaurant');
                setRestaurantId(restId);
                setTaxRate(restaurantData.taxRate || 0.08);

                // Load menu items for this restaurant
                const menuRef = collection(db, 'menu_items');
                const menuQuery = query(menuRef, where('restaurantId', '==', restId), where('isAvailable', '==', true));
                const menuSnapshot = await getDocs(menuQuery);

                const items: MenuItem[] = [];
                menuSnapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as MenuItem);
                });

                setMenuItems(items);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: MenuItem) => {
        const existingItem = cart.find((cartItem) => cartItem.id === item.id);

        if (existingItem) {
            setCart(
                cart.map((cartItem) =>
                    cartItem.id === item.id
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                )
            );
        } else {
            setCart([...cart, { ...item, quantity: 1 }]);
        }
    };

    const updateQuantity = (itemId: string, change: number) => {
        setCart(
            cart
                .map((item) =>
                    item.id === itemId
                        ? { ...item, quantity: Math.max(0, item.quantity + change) }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    const removeFromCart = (itemId: string) => {
        setCart(cart.filter((item) => item.id !== itemId));
    };

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const handleCheckout = async () => {
        if (cart.length === 0 || !sessionId) return;

        try {
            // Find table ID
            const tablesRef = collection(db, 'tables');
            const tableQuery = query(tablesRef, where('name', '==', tableName));
            const tableSnapshot = await getDocs(tableQuery);

            let tableId = 'unknown';
            if (!tableSnapshot.empty) {
                tableId = tableSnapshot.docs[0].id;
            }

            const order = {
                restaurantId,
                tableId,
                tableName,
                sessionId,
                items: cart.map((item) => ({
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                })),
                status: 'pending',
                subtotal,
                tax,
                total,
                createdAt: new Date(),
            };

            await addDoc(collection(db, 'orders'), order);

            alert('Order placed successfully!');
            setCart([]);
            setCartOpen(false);
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Failed to place order. Please try again.');
        }
    };

    const categories = Array.from(new Set(menuItems.map((item) => item.category)));
    const displayedItems = selectedCategory
        ? menuItems.filter((item) => item.category === selectedCategory)
        : menuItems;

    const handleRequestBill = async () => {
        if (!sessionId) return;
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, { status: 'payment_pending' });
            alert('Server notified! Your bill is on the way.');
        } catch (error) {
            console.error('Error requesting bill:', error);
            alert('Failed to request bill');
        }
    };

    const handleDownloadBill = () => {
        const doc = new jsPDF();
        let yPos = 20;

        // Header
        doc.setFontSize(20);
        doc.text(restaurantName, 105, yPos, { align: 'center' });
        yPos += 10;
        doc.setFontSize(12);
        doc.text('Receipt', 105, yPos, { align: 'center' });
        yPos += 10;
        doc.text(`Table: ${tableName}`, 20, yPos);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, yPos);
        yPos += 15;

        // Items
        doc.line(20, yPos, 190, yPos);
        yPos += 10;

        let subtotal = 0;
        billOrders.forEach(order => {
            order.items.forEach(item => {
                doc.text(item.name, 20, yPos);
                doc.text(`${item.quantity}x`, 130, yPos);
                doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });
                yPos += 7;
                subtotal += item.price * item.quantity;
            });
        });

        yPos += 5;
        doc.line(20, yPos, 190, yPos);
        yPos += 10;

        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 190, yPos, { align: 'right' });
        yPos += 7;
        doc.text(`Tax: $${tax.toFixed(2)}`, 190, yPos, { align: 'right' });
        yPos += 10;
        doc.setFontSize(14);
        doc.text(`Total: $${total.toFixed(2)}`, 190, yPos, { align: 'right' });

        doc.save('receipt.pdf');
    };

    const handleLeave = () => {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('customerName');
        localStorage.removeItem('customerPhone');
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                <ChefHat className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div className="text-left hidden sm:block">
                                <div className="font-semibold">{restaurantName}</div>
                                <div className="text-xs text-muted-foreground">{tableName}</div>
                            </div>
                        </button>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleRequestBill}
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary/10"
                            >
                                <Receipt className="h-5 w-5 mr-2" />
                                Ready to Pay
                            </Button>
                            <Button onClick={() => setCartOpen(true)} variant="outline" className="relative">
                                <ShoppingCart className="h-5 w-5 mr-2" />
                                Cart
                                {cart.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* Category Navigation */}
                    {categories.length > 0 && (
                        <aside className="hidden lg:block w-64 sticky top-20 h-fit">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Categories</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <nav className="space-y-1">
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${!selectedCategory ? 'bg-accent font-medium' : ''
                                                }`}
                                        >
                                            All Items
                                        </button>
                                        {categories.map((category) => (
                                            <button
                                                key={category}
                                                onClick={() => setSelectedCategory(category)}
                                                className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${selectedCategory === category ? 'bg-accent font-medium' : ''
                                                    }`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </nav>
                                </CardContent>
                            </Card>
                        </aside>
                    )}

                    {/* Menu Items */}
                    <div className="flex-1">
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold">
                                {selectedCategory || 'Our Menu'}
                            </h1>
                            <p className="text-muted-foreground">
                                {displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'}
                            </p>
                        </div>

                        {displayedItems.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <p>No menu items available at the moment.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {displayedItems.map((item) => (
                                    <Card key={item.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                                        <CardContent className="p-0 flex flex-col sm:flex-row">
                                            {item.imageUrl && (
                                                <div className="w-full sm:w-48 h-48 sm:h-auto relative shrink-0 bg-gray-100">
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=No+Image';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 p-6 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="font-bold text-xl">{item.name}</h3>
                                                        {item.isChefSpecial && (
                                                            <div className="flex items-center text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                                                                <ChefHat className="w-3 h-3 mr-1" />
                                                                Chef's Special
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="text-muted-foreground mb-3 line-clamp-2">{item.description}</p>

                                                    <div className="flex flex-wrap gap-2 mb-3 items-center">
                                                        {(item.spiceLevel || 0) > 0 && (
                                                            <div className="flex text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100" title={`Spice Level: ${item.spiceLevel}`}>
                                                                {Array.from({ length: item.spiceLevel || 0 }).map((_, i) => (
                                                                    <Flame key={i} className="w-3 h-3 fill-current" />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {item.dietary?.map(tag => (
                                                            <span key={tag} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200 capitalize font-medium">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {item.allergens && item.allergens.length > 0 && (
                                                        <div className="flex items-center text-xs text-muted-foreground mt-2">
                                                            <Info className="w-3 h-3 mr-1" />
                                                            <span className="font-medium mr-1">Contains:</span> {item.allergens.join(', ')}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                                    <span className="text-xl font-bold text-primary">
                                                        ${item.price.toFixed(2)}
                                                    </span>
                                                    <Button onClick={() => addToCart(item)} size="sm">
                                                        <Plus className="h-4 w-4 mr-1" />
                                                        Add to Order
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart Modal */}
            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Your Order
                        </DialogTitle>
                        <DialogDescription>
                            {tableName} • {cart.length} {cart.length === 1 ? 'item' : 'items'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        {cart.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <p>Your cart is empty</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 pb-3 border-b">
                                    <div className="flex-1">
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            ${item.price.toFixed(2)} each
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
                                            onClick={() => updateQuantity(item.id, -1)}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center">{item.quantity}</span>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8"
                                            onClick={() => updateQuantity(item.id, 1)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => removeFromCart(item.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <>
                            <div className="space-y-2 pt-4 border-t">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>

                            <DialogFooter className="sm:justify-between pt-4">
                                <Button variant="outline" onClick={() => setCartOpen(false)}>
                                    Continue Shopping
                                </Button>
                                <Button onClick={handleCheckout}>Place Order</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Bill / Session Closed Dialog */}
            <Dialog open={isSessionClosed} onOpenChange={() => { }}>
                <DialogContent className="max-w-md bg-white" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl">Thank You!</DialogTitle>
                        <DialogDescription className="text-center">
                            Your session has been closed. We hope you enjoyed your meal.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between font-medium">
                                <span>Total Paid</span>
                                <span>
                                    ${(billOrders.reduce((sum, order) => sum + order.total, 0)).toFixed(2)}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground text-center pt-2">
                                A copy of your receipt is available for download.
                            </p>
                        </div>

                        <Button onClick={handleDownloadBill} className="w-full" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Download Receipt PDF
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleLeave} className="w-full">
                            Return to Home
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
