import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
    serverTimestamp,
    onSnapshot,
} from 'firebase/firestore';
import type { MenuItem, CartItem, Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ChefHat, ShoppingCart, Plus, Minus, Trash2, Receipt, Download, Search, History, CheckCircle2, ChevronDown, ChevronRight, X, Banknote, CreditCard } from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSelector from '@/components/shared/LanguageSelector';

const MenuItemRow = ({ item, onAdd, showDivider }: { item: MenuItem, onAdd: (item: MenuItem) => void, showDivider: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { getLocalizedText, t } = useLanguage();
    const hasCustomization = item.customizationOptions && item.customizationOptions.length > 0;
    const descriptionLimit = 80;

    const localizedName = getLocalizedText(item, 'name');
    const localizedDescription = getLocalizedText(item, 'description');
    const isLongDescription = localizedDescription?.length > descriptionLimit;

    return (
        <div className="relative">
            <div className={`flex gap-3 ${hasCustomization ? 'pt-2.5 pb-3' : 'pt-1.5 pb-7'}`}>
                {/* Left Content */}
                <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            {item.dietary?.includes('non-vegetarian') ? (
                                <div className="border border-red-600 p-[2px] rounded-sm" title="Non-Vegetarian">
                                    <div className="w-2 h-2 bg-red-600 rounded-full" />
                                </div>
                            ) : (
                                <div className="border border-green-600 p-[2px] rounded-sm" title="Vegetarian">
                                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                                </div>
                            )}
                            <h3 className="font-bold text-lg">{localizedName}</h3>

                            {/* Chef's Special and Bestseller Badges */}
                            <div className="flex items-center gap-1.5">
                                {item.isChefSpecial && (
                                    <div className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 text-sm px-1.5 py-0.5 rounded-full font-bold border border-orange-200 flex items-center" title="Chef's Special">
                                        <ChefHat className="w-3.5 h-3.5" />
                                    </div>
                                )}
                                {item.isBestseller && (
                                    <div className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 text-sm px-1.5 py-0.5 rounded-full font-bold border border-orange-200" title="Bestseller">
                                        ⭐
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="font-bold text-orange-600 text-base">€{item.price.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground leading-snug">
                        {isExpanded || !isLongDescription ? (
                            localizedDescription
                        ) : (
                            <>
                                {localizedDescription.slice(0, descriptionLimit)}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(true);
                                    }}
                                    className="ml-1 font-bold text-gray-600 hover:text-black transition-colors"
                                >
                                    ... more
                                </button>
                            </>
                        )}
                    </div>

                    {/* Dietary Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.dietary?.includes('vegan') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
                                🌱 Vegan
                            </span>
                        )}
                        {item.dietary?.includes('vegetarian') && !item.dietary?.includes('vegan') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
                                🥬 Vegetarian
                            </span>
                        )}
                        {item.dietary?.includes('gluten-free') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">
                                🌾 Gluten-Free
                            </span>
                        )}
                        {item.dietary?.includes('dairy') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                🥛 Dairy
                            </span>
                        )}
                        {item.dietary?.includes('gluten') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
                                🍞 Gluten
                            </span>
                        )}
                        {/* Spice Level */}
                        {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 border border-red-200">
                                {item.spiceLevel === 1 && '🌶️'}
                                {item.spiceLevel === 2 && '🌶️🌶️'}
                                {item.spiceLevel === 3 && '🌶️🌶️🌶️'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Image & Button */}
                <div className="w-32 shrink-0">
                    <div className="relative w-full h-32">
                        {item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover rounded-xl"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center text-orange-400">
                                <ChefHat className="w-7 h-7" />
                            </div>
                        )}

                        {/* ADD button overlapping image */}
                        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                            <Button
                                className="w-24 bg-green-600 text-white hover:bg-green-700 border-none shadow-sm font-bold h-8 uppercase text-sm rounded-lg transition-all duration-300"
                                onClick={() => onAdd(item)}
                            >
                                {t('item.add')}
                            </Button>
                        </div>
                    </div>

                    {/* Customisable text below */}
                    {hasCustomization && (
                        <div className="mt-3.5 text-center">
                            <span className="text-[11px] text-gray-500 font-medium">{t('item.customizable')}</span>
                        </div>
                    )}
                </div>
            </div>
            {/* Separator line */}
            {showDivider && (
                <div className="border-b border-gray-200" />
            )}
        </div>
    );
};



export default function MenuOrderPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tableName = searchParams.get('table') || 'Unknown Table';
    const { t, language, getLocalizedText } = useLanguage();

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
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [subcategoryOrder, setSubcategoryOrder] = useState<Record<string, string[]>>({});
    const [categoryTranslations, setCategoryTranslations] = useState<Record<string, { es?: string }>>({});
    const [subcategoryTranslations, setSubcategoryTranslations] = useState<Record<string, { es?: string }>>({});
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [billOrders, setBillOrders] = useState<Order[]>([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        veg: false,
        nonVeg: false,
        vegan: false,
        gf: false,
        spiceLevel: null as number | null,
        chefSpecial: false,
        bestseller: false,
    });

    // Customization Modal State
    const [customizationModalOpen, setCustomizationModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [customizationSelections, setCustomizationSelections] = useState<Record<string, any[]>>({});
    const [itemNotes, setItemNotes] = useState('');

    // Past Orders Modal State
    const [pastOrdersOpen, setPastOrdersOpen] = useState(false);
    const [pastOrders, setPastOrders] = useState<Order[]>([]);

    // Mobile Category Modal State
    const [mobileCategoryModalOpen, setMobileCategoryModalOpen] = useState(false);

    // Toast notification state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Placing order state to prevent duplicate submissions
    const [placingOrder, setPlacingOrder] = useState(false);

    // Tip dialog state
    const [tipDialogOpen, setTipDialogOpen] = useState(false);
    const [selectedTipPercentage, setSelectedTipPercentage] = useState<number | null>(null);
    const [customTipAmount, setCustomTipAmount] = useState('');
    const [calculatedTip, setCalculatedTip] = useState(0);
    const [sessionTipAmount, setSessionTipAmount] = useState(0);

    // Payment type state
    // Payment type state
    const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
    const [, setSelectedPaymentMethod] = useState<'cash' | 'card' | null>(null);

    // Helper to get localized subcategory name
    const getLocalizedCategory = (category: string): string => {
        if (language === 'es' && categoryTranslations[category]?.es) {
            return categoryTranslations[category].es;
        }
        return category;
    };

    const getLocalizedSubcategory = (category: string, subcategory: string): string => {
        const key = `${category}:${subcategory}`;
        if (language === 'es' && subcategoryTranslations[key]?.es) {
            return subcategoryTranslations[key].es;
        }
        return subcategory;
    };

    // HISTORY MANAGEMENT FOR MOBILE BACK BUTTON
    useEffect(() => {
        if (customizationModalOpen) {
            // Push state when modal opens
            window.history.pushState({ modal: 'customization' }, '', window.location.href);

            const handlePopState = () => {
                // When back button is pressed, close the modal
                setCustomizationModalOpen(false);
                setSelectedItem(null);
            };

            window.addEventListener('popstate', handlePopState);

            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [customizationModalOpen]);

    const handleModalOpenChange = (open: boolean) => {
        if (open) {
            setCustomizationModalOpen(true);
        } else {
            // Trigger back navigation to close modal via popstate
            // Check if we have history state to pop
            window.history.back();
        }
    };

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
                    // Store tip amount from session
                    setSessionTipAmount(data.tipAmount || 0);

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

                if (restaurantData.categoryOrder) {
                    setCategoryOrder(restaurantData.categoryOrder);
                }
                if (restaurantData.subcategoryOrder) {
                    setSubcategoryOrder(restaurantData.subcategoryOrder);
                }
                if (restaurantData.categoryTranslations) {
                    setCategoryTranslations(restaurantData.categoryTranslations);
                }
                if (restaurantData.subcategoryTranslations) {
                    setSubcategoryTranslations(restaurantData.subcategoryTranslations);
                }

                // Sort items by their order field
                items.sort((a, b) => (a.order || 0) - (b.order || 0));

                setMenuItems(items);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: MenuItem | CartItem) => {
        // If it's a custom item (has notes or customizations), always add as new
        if ('selectedCustomizations' in item || 'notes' in item) {
            setCart([...cart, { ...item, quantity: 1, id: `${item.id}-${Date.now()}` } as CartItem]);
            showAddedToCartToast(item.name);
            return;
        }

        const existingItem = cart.find((cartItem) => cartItem.id === item.id && !cartItem.selectedCustomizations);

        if (existingItem) {
            setCart(
                cart.map((cartItem) =>
                    cartItem.id === item.id && !cartItem.selectedCustomizations
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                )
            );
        } else {
            setCart([...cart, { ...item, quantity: 1 } as CartItem]);
        }
        showAddedToCartToast(item.name);
    };

    const showAddedToCartToast = (itemName: string) => {
        setToastMessage(`${itemName} added to cart`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
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
        if (cart.length === 0 || !sessionId || placingOrder) return;

        setPlacingOrder(true);
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
                    category: item.category,
                })),
                status: 'pending',
                subtotal,
                tax,
                total,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'orders'), order);

            // Reset session status to active (overriding payment_pending) and clear any set tip
            // This ensures the table shows as "Occupied" (grey) instead of "Bill Ready" (red blinking)
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                status: 'active',
                tipAmount: 0,
                tipPercentage: null
            });

            toast.success('Order placed successfully!');
            setCart([]);
            setCartOpen(false);
        } catch (error) {
            console.error('Error placing order:', error);
            toast.error('Failed to place order. Please try again.');
        } finally {
            setPlacingOrder(false);
        }
    };

    const uniqueCategories = Array.from(new Set(menuItems.map((item) => item.category)));
    const categories = Array.from(new Set([...categoryOrder, ...uniqueCategories])).filter(c => uniqueCategories.includes(c));

    // Check if selected category has subcategories
    const selectedCategoryHasSubcats = selectedCategory
        ? menuItems.some(item => item.category === selectedCategory && item.subcategory)
        : false;

    const displayedItems = selectedCategory
        ? selectedSubcategory
            ? menuItems.filter((item) => item.category === selectedCategory && item.subcategory === selectedSubcategory)
            : selectedCategoryHasSubcats
                ? [] // If category has subcategories but none selected, show nothing
                : menuItems.filter((item) => item.category === selectedCategory)
        : menuItems;

    const filteredItems = displayedItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (activeFilters.veg && !item.dietary?.includes('vegetarian')) return false;
        if (activeFilters.nonVeg && !item.dietary?.includes('non-vegetarian')) return false;
        if (activeFilters.vegan && !item.dietary?.includes('vegan')) return false;
        if (activeFilters.gf && !item.dietary?.includes('gluten-free')) return false;
        if (activeFilters.chefSpecial && !item.isChefSpecial) return false;
        if (activeFilters.bestseller && !item.isBestseller) return false;
        if (activeFilters.spiceLevel !== null && item.spiceLevel !== activeFilters.spiceLevel) return false;

        return true;
    });

    const handleAddToCartClick = (item: MenuItem) => {
        setSelectedItem(item);
        setCustomizationSelections({});
        setItemNotes('');
        setCustomizationModalOpen(true);
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

        addToCart(customItem);
        // Go back in history to close modal (matches useEffect logic)
        window.history.back();
    };

    const handleFetchPastOrders = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef, where('sessionId', '==', sessionId));
            const snapshot = await getDocs(q);
            const orders: Order[] = [];
            snapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() } as Order);
            });
            // Sort by date desc
            orders.sort((a, b) => (b.createdAt as any).seconds - (a.createdAt as any).seconds);
            setPastOrders(orders);
            setPastOrdersOpen(true);
        } catch (error) {
            console.error("Error fetching past orders", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestBill = async () => {
        if (!sessionId) return;

        // Fetch current orders to ensure we have the correct total for tip calculation
        try {
            setLoading(true);
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef, where('sessionId', '==', sessionId));
            const snapshot = await getDocs(q);
            const orders: Order[] = [];
            snapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() } as Order);
            });
            setBillOrders(orders);
            setTipDialogOpen(true);
        } catch (error) {
            console.error('Error fetching orders for bill:', error);
            toast.error('Failed to load bill information');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmBillWithTip = async () => {
        // Close tip dialog and open payment method selection
        setTipDialogOpen(false);
        setPaymentMethodModalOpen(true);
    };

    const handlePaymentMethodSelect = (method: 'cash' | 'card') => {
        setSelectedPaymentMethod(method);
        setPaymentMethodModalOpen(false);
        handleFinalBillSubmit('full', method);
    };

    const handleFinalBillSubmit = async (paymentType: 'full' | 'split', paymentMethod: 'cash' | 'card' | null) => {
        if (!sessionId) return;
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                status: 'payment_pending',
                tipAmount: calculatedTip,
                tipPercentage: selectedTipPercentage,
                paymentType,
                paymentMethod
            });

            // Reset all payment states
            setSelectedPaymentMethod(null);
            setSelectedTipPercentage(null);
            setCustomTipAmount('');
            setCalculatedTip(0);

            const methodText = paymentType === 'split'
                ? 'Split Payment'
                : (paymentMethod === 'cash' ? 'Cash' : 'Card');
            toast.success(`Server notified! Payment method: ${methodText}. Your bill is on the way.`);
        } catch (error) {
            console.error('Error requesting bill:', error);
            toast.error('Failed to request bill');
        }
    };

    // Calculate tip when percentage or custom amount changes
    useEffect(() => {
        if (selectedTipPercentage !== null) {
            // Calculate based on percentage
            const billSubtotal = billOrders.reduce((sum, order) => {
                return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
            }, 0);

            // Tip calculated on subtotal only (excluding tax)
            setCalculatedTip(billSubtotal * (selectedTipPercentage / 100));
            setCustomTipAmount(''); // Clear custom amount
        } else if (customTipAmount) {
            // Use custom amount
            const amount = parseFloat(customTipAmount);
            setCalculatedTip(isNaN(amount) ? 0 : amount);
        } else {
            setCalculatedTip(0);
        }
    }, [selectedTipPercentage, customTipAmount, billOrders, taxRate]);

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
                doc.text(`${item.name} x${item.quantity}`, 20, yPos);
                doc.text(`€${(item.price * item.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });
                yPos += 7;
                subtotal += item.price * item.quantity;
            });
        });

        yPos += 5;
        doc.line(20, yPos, 190, yPos);
        yPos += 10;

        const tax = subtotal * taxRate;
        const total = subtotal + tax + sessionTipAmount;

        doc.text(`Subtotal: €${subtotal.toFixed(2)}`, 190, yPos, { align: 'right' });
        yPos += 7;
        doc.text(`Tax: €${tax.toFixed(2)}`, 190, yPos, { align: 'right' });
        yPos += 7;
        if (sessionTipAmount > 0) {
            doc.text(`Server Tip: €${sessionTipAmount.toFixed(2)}`, 190, yPos, { align: 'right' });
            yPos += 7;
        }
        yPos += 3;
        doc.setFontSize(14);
        doc.text(`Total: €${total.toFixed(2)}`, 190, yPos, { align: 'right' });

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
        <div className="min-h-screen bg-white">
            {/* Navbar */}
            <header className="sticky top-0 z-40 bg-gradient-to-r from-orange-500 to-red-500 shadow-md">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                <ChefHat className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left hidden sm:block">
                                <div className="font-semibold text-white">{restaurantName}</div>
                                <div className="text-xs text-white/80">{tableName}</div>
                            </div>
                        </button>


                        <div className="flex items-center gap-2">
                            {/* Language Selector */}
                            <LanguageSelector />

                            <Button
                                onClick={handleRequestBill}
                                variant="outline"
                                className="border-white text-white hover:bg-white/20 transition-colors"
                            >
                                <Receipt className="h-5 w-5 mr-2" />
                                {t('bill.request')}
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button className="relative bg-white text-orange-600 hover:bg-white/90 shadow-md font-semibold" onClick={() => setCartOpen(true)}>
                                    <ShoppingCart className="h-5 w-5 mr-2" />
                                    {t('cart.button')}
                                    {cart.length > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                                            {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                        </span>
                                    )}
                                </Button>

                            </div>                   </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* Category Navigation */}
                    {categories.length > 0 && (
                        <aside className="hidden lg:block w-64 pr-6">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">{t('menu.categories')}</h2>
                                <nav className="space-y-1">
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(null);
                                            setSelectedSubcategory(null);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors text-sm font-medium ${!selectedCategory
                                            ? 'text-orange-600 bg-orange-50 border-l-4 border-orange-600'
                                            : 'text-gray-700 border-l-4 border-transparent'
                                            }`}
                                    >
                                        {t('menu.allItems')}
                                    </button>
                                    {categories.map((category) => {
                                        // Get subcategories for this category from menu items
                                        const categorySubcats = Array.from(new Set(
                                            menuItems
                                                .filter(item => item.category === category && item.subcategory)
                                                .map(item => item.subcategory!)
                                        ));
                                        // Sort by subcategoryOrder
                                        const orderedSubcats = subcategoryOrder[category] || [];
                                        const sortedSubcats = [...new Set([...orderedSubcats, ...categorySubcats])].filter(s => categorySubcats.includes(s));
                                        const hasSubcategories = sortedSubcats.length > 0;
                                        const isExpanded = expandedCategories.has(category);
                                        const isActive = selectedCategory === category;

                                        return (
                                            <div key={category}>
                                                <button
                                                    onClick={() => {
                                                        if (hasSubcategories) {
                                                            // Toggle expansion
                                                            setExpandedCategories(prev => {
                                                                const newSet = new Set(prev);
                                                                if (newSet.has(category)) {
                                                                    newSet.delete(category);
                                                                } else {
                                                                    newSet.add(category);
                                                                }
                                                                return newSet;
                                                            });
                                                        }
                                                        setSelectedCategory(category);
                                                        setSelectedSubcategory(null);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors text-sm font-medium flex items-center justify-between ${isActive && !selectedSubcategory
                                                        ? 'text-orange-600 bg-orange-50 border-l-4 border-orange-600'
                                                        : isActive && selectedSubcategory
                                                            ? 'text-orange-500 border-l-4 border-orange-300'
                                                            : 'text-gray-700 border-l-4 border-transparent'
                                                        }`}
                                                >
                                                    <span>{getLocalizedCategory(category)}</span>
                                                    {hasSubcategories && (
                                                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                    )}
                                                </button>
                                                {/* Subcategory list */}
                                                {hasSubcategories && isExpanded && (
                                                    <div className="ml-4 border-l border-gray-200">
                                                        {sortedSubcats.map(subcat => (
                                                            <button
                                                                key={subcat}
                                                                onClick={() => {
                                                                    setSelectedCategory(category);
                                                                    setSelectedSubcategory(subcat);
                                                                }}
                                                                className={`w-full text-left px-4 py-2 hover:bg-orange-50 transition-colors text-xs font-medium ${selectedSubcategory === subcat
                                                                    ? 'text-orange-600 bg-orange-50'
                                                                    : 'text-gray-600'
                                                                    }`}
                                                            >
                                                                {getLocalizedSubcategory(category, subcat)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </nav>
                            </div>
                        </aside>
                    )}

                    <div className="flex-1">
                        {/* Search and Filters */}
                        <div className="mb-6">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <input
                                        type="text"
                                        placeholder={t('menu.search')}
                                        className="w-full pl-10 pr-4 py-2 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="relative">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="h-full px-4 border-orange-200 hover:bg-orange-50"
                                    >
                                        <span className="hidden sm:inline mr-2">{t('menu.filters')}</span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                    </Button>

                                    {showFilters && (
                                        <div className="absolute right-0 mt-2 p-4 border border-orange-200 rounded-lg bg-white shadow-lg z-10 w-64 grid grid-cols-2 gap-2">
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.veg}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, veg: !prev.veg }))}
                                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">{t('filter.vegetarian')}</span>
                                            </label>
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.nonVeg}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, nonVeg: !prev.nonVeg }))}
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                />
                                                <span className="text-sm">{t('filter.nonVeg')}</span>
                                            </label>
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.vegan}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, vegan: !prev.vegan }))}
                                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm">{t('filter.vegan')}</span>
                                            </label>
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.gf}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, gf: !prev.gf }))}
                                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span className="text-sm">{t('filter.glutenFree')}</span>
                                            </label>
                                            <label className="flex items-center space-x-2 col-span-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.chefSpecial}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, chefSpecial: !prev.chefSpecial }))}
                                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                />
                                                <span className="text-sm">{t('filter.chefSpecial')}</span>
                                            </label>
                                            <label className="flex items-center space-x-2 col-span-2">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilters.bestseller}
                                                    onChange={() => setActiveFilters(prev => ({ ...prev, bestseller: !prev.bestseller }))}
                                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                />
                                                <span className="text-sm">{t('filter.bestseller')}</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h1 className="text-3xl font-bold">
                                {selectedCategory ? getLocalizedCategory(selectedCategory) : t('menu.ourMenu')}
                            </h1>
                            <p className="text-muted-foreground">
                                {filteredItems.length} {filteredItems.length === 1 ? t('cart.item') : t('cart.items')}
                            </p>
                        </div>

                        {filteredItems.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <p>
                                        {selectedCategoryHasSubcats && !selectedSubcategory
                                            ? t('category.selectSubcategory')
                                            : t('general.noResults') + ' matching your criteria.'
                                        }
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-0">
                                {/* Group items by category, then iterate in categoryOrder */}
                                {(() => {
                                    const itemsByCategory = filteredItems.reduce((acc, item) => {
                                        const cat = item.category || 'Other';
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push(item);
                                        return acc;
                                    }, {} as Record<string, MenuItem[]>);

                                    // Get all categories that have items
                                    const categoriesWithItems = Object.keys(itemsByCategory);

                                    // Sort categories: first by categoryOrder, then any remaining
                                    const sortedCategories = [...new Set([...categoryOrder, ...categoriesWithItems])].filter(c => categoriesWithItems.includes(c));

                                    return sortedCategories.map(category => {
                                        const items = itemsByCategory[category] || [];
                                        // Group items by subcategory
                                        const itemsBySub: Record<string, MenuItem[]> = { 'direct': [] };

                                        items.forEach(item => {
                                            if (item.subcategory) {
                                                if (!itemsBySub[item.subcategory]) itemsBySub[item.subcategory] = [];
                                                itemsBySub[item.subcategory].push(item);
                                            } else {
                                                itemsBySub['direct'].push(item);
                                            }
                                        });

                                        // Determine order of subcategories from restaurant's subcategoryOrder
                                        const categorySubOrder = subcategoryOrder[category] || [];
                                        const subcategoryKeys = Object.keys(itemsBySub).filter(k => k !== 'direct');
                                        // Sort subcategories: first by order in subcategoryOrder, then alphabetically for any not in list
                                        const subkeys = [...new Set([...categorySubOrder, ...subcategoryKeys])].filter(k => subcategoryKeys.includes(k));

                                        return (
                                            <div key={category} id={`category-${category}`}>
                                                {!selectedCategory && (
                                                    <h2 className="text-2xl font-bold mb-3 pb-2 text-gray-800 border-b-2 border-orange-200">{category}</h2>
                                                )}

                                                {/* Direct Items */}
                                                {itemsBySub['direct'].length > 0 && (
                                                    <div className="mb-4">
                                                        {itemsBySub['direct'].map((item, index) => (
                                                            <MenuItemRow key={item.id} item={item} onAdd={handleAddToCartClick} showDivider={index < itemsBySub['direct'].length - 1} />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Subcategories */}
                                                {subkeys.map(sub => (
                                                    <div key={sub} className="mb-6 ml-2">
                                                        <h3 className="text-xl font-semibold mb-3 text-orange-900/80">{sub}</h3>
                                                        {itemsBySub[sub].map((item, index) => (
                                                            <MenuItemRow key={item.id} item={item} onAdd={handleAddToCartClick} showDivider={index < itemsBySub[sub].length - 1} />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    });
                                })()}
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setCartOpen(false);
                                handleFetchPastOrders();
                            }}
                            className="absolute right-12 top-3 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                            <History className="h-4 w-4" />
                            Orders
                        </Button>
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
                                            €{item.price.toFixed(2)} each
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
                                    <span>€{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Tax ({(taxRate * 100).toFixed(0)}%):</span>
                                    <span>€{tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>€{total.toFixed(2)}</span>
                                </div>
                            </div>

                            <DialogFooter className="sm:justify-between pt-4">
                                <Button variant="outline" onClick={() => setCartOpen(false)}>
                                    Continue Shopping
                                </Button>
                                <Button onClick={handleCheckout} disabled={placingOrder}>
                                    {placingOrder ? 'Placing Order...' : 'Place Order'}
                                </Button>
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
                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>
                                    €{(billOrders.reduce((sum, order) => {
                                        return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
                                    }, 0)).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Tax</span>
                                <span>
                                    €{(billOrders.reduce((sum, order) => {
                                        return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
                                    }, 0) * taxRate).toFixed(2)}
                                </span>
                            </div>
                            {sessionTipAmount > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>Server Tip</span>
                                    <span>€{sessionTipAmount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total Paid</span>
                                    <span>
                                        €{(billOrders.reduce((sum, order) => {
                                            return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
                                        }, 0) * (1 + taxRate) + sessionTipAmount).toFixed(2)}
                                    </span>
                                </div>
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

            {/* Item Detail & Customization Modal */}
            <Dialog open={customizationModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-lg max-h-[90vh] flex flex-col bg-white p-0 gap-0 overflow-hidden" hideClose>
                    {selectedItem && (
                        <>
                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto">
                                {/* Item Image */}
                                <div className="relative h-64 sm:h-72 w-full">
                                    {selectedItem.imageUrl ? (
                                        <img
                                            src={selectedItem.imageUrl}
                                            alt={selectedItem.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-orange-400">
                                            <ChefHat className="w-12 h-12" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setCustomizationModalOpen(false)}
                                        className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Header Info */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {selectedItem.dietary?.includes('non-vegetarian') ? (
                                                        <div className="border border-red-600 p-[2px] rounded-sm">
                                                            <div className="w-2 h-2 bg-red-600 rounded-full" />
                                                        </div>
                                                    ) : (
                                                        <div className="border border-green-600 p-[2px] rounded-sm">
                                                            <div className="w-2 h-2 bg-green-600 rounded-full" />
                                                        </div>
                                                    )}
                                                    <DialogTitle className="text-2xl font-bold">{getLocalizedText(selectedItem, 'name')}</DialogTitle>
                                                </div>
                                                <p className="text-xl font-bold text-orange-600">€{selectedItem.price.toFixed(2)}</p>
                                            </div>

                                            {/* Badges */}
                                            <div className="flex gap-2">
                                                {selectedItem.isChefSpecial && (
                                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">{t('filter.chefSpecial')}</span>
                                                )}
                                                {selectedItem.isBestseller && (
                                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">{t('filter.bestseller')}</span>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-gray-600 leading-relaxed">{getLocalizedText(selectedItem, 'description')}</p>

                                        {/* Allergens */}
                                        {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                                            <div className="pt-2">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('item.allergenInfo')}</h4>
                                                <p className="text-sm text-gray-500 italic">
                                                    {t('item.contains')}: {selectedItem.allergens.join(', ')}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Customization Groups */}
                                    {selectedItem.customizationOptions?.map((group) => (
                                        <div key={group.id} className="space-y-4 pt-4 border-t">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h3 className="font-bold text-lg">{group.name}</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {group.type === 'single' ? 'Select 1 option' : `Select up to ${group.maxSelection || 'any'} options`}
                                                    </p>
                                                </div>
                                                {group.type === 'single' && (
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold uppercase">Required</span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                {group.options.map((option) => {
                                                    const isSelected = customizationSelections[group.id]?.some(opt => opt.name === option.name);
                                                    return (
                                                        <label
                                                            key={option.name}
                                                            className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-green-600 bg-green-50/50' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setCustomizationSelections(prev => {
                                                                    const current = prev[group.id] || [];
                                                                    if (group.type === 'single') {
                                                                        return { ...prev, [group.id]: [option] };
                                                                    } else {
                                                                        if (isSelected) {
                                                                            return { ...prev, [group.id]: current.filter(o => o.name !== option.name) };
                                                                        } else {
                                                                            if (group.maxSelection && current.length >= group.maxSelection) return prev;
                                                                            return { ...prev, [group.id]: [...current, option] };
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {group.type === 'single' ? (
                                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-green-600' : 'border-gray-300'}`}>
                                                                        {isSelected && <div className="w-2.5 h-2.5 bg-green-600 rounded-full" />}
                                                                    </div>
                                                                ) : (
                                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                                                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-800">{option.name}</span>
                                                                    <div className="flex gap-1.5 mt-0.5">
                                                                        {option.isVegetarian && <span className="text-[9px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold uppercase">Veg</span>}
                                                                        {option.isVegan && <span className="text-[9px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold uppercase">Vegan</span>}
                                                                        {option.isGlutenFree && <span className="text-[9px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold uppercase">GF</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-bold text-gray-600">
                                                                {option.price > 0 ? `+€${option.price.toFixed(2)}` : '€0.00'}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Notes Section */}
                                    <div className="space-y-3 pt-6 border-t">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg">{t('item.notesTitle')}</h3>
                                            <span className="text-xs text-muted-foreground font-medium">({t('item.optional')})</span>
                                        </div>
                                        <textarea
                                            className="w-full min-h-[100px] p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 rounded-2xl resize-none focus:outline-none transition-all text-sm"
                                            placeholder={t('item.notesPlaceholder')}
                                            value={itemNotes}
                                            onChange={(e) => setItemNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Footer */}
                            <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-200 transition-all active:scale-95 flex justify-between px-6"
                                    onClick={handleConfirmCustomization}
                                >
                                    <span>{t('item.addItemToCart')}</span>
                                    <span>
                                        €{(selectedItem.price + Object.values(customizationSelections).flat().reduce((sum, opt) => sum + opt.price, 0)).toFixed(2)}
                                    </span>
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Past Orders Modal */}
            <Dialog open={pastOrdersOpen} onOpenChange={setPastOrdersOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Past Orders
                        </DialogTitle>
                        <DialogDescription>
                            Your order history for this session
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 py-4">
                        {pastOrders.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <p>No past orders found.</p>
                            </div>
                        ) : (
                            pastOrders.map((order) => (
                                <div key={order.id} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-center pb-2 border-b">
                                        <span className="font-medium text-sm text-muted-foreground">
                                            {order.createdAt && (order.createdAt as any).toDate ?
                                                (order.createdAt as any).toDate().toLocaleDateString() + ' ' +
                                                (order.createdAt as any).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                'Invalid Date'
                                            }
                                        </span>

                                    </div>
                                    <div className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span>{item.quantity}x {item.name}</span>
                                                <span>€{(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t flex justify-between font-bold">
                                        <span>Total</span>
                                        <span>€{order.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Floating MENU Button (Mobile Only) */}
            {categories.length > 0 && (
                <button
                    onClick={() => setMobileCategoryModalOpen(true)}
                    className="lg:hidden fixed bottom-6 right-6 z-50 bg-black text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg font-bold text-sm hover:bg-gray-800 transition-colors"
                >
                    MENU
                </button>
            )}

            {/* Mobile Category Navigation Modal */}
            {mobileCategoryModalOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setMobileCategoryModalOpen(false)}
                    />
                    {/* Modal Content */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gray-900 px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{t('menu.menuCategories')}</h2>
                            <button
                                onClick={() => setMobileCategoryModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-6 py-4 space-y-2 pb-24">
                            <button
                                onClick={() => {
                                    setSelectedCategory(null);
                                    setSelectedSubcategory(null);
                                    setMobileCategoryModalOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors flex justify-between items-center ${!selectedCategory ? 'bg-gray-800' : ''
                                    }`}
                            >
                                <span className="font-medium">{t('menu.allItems')}</span>
                                <span className="text-sm text-gray-400">{menuItems.length}</span>
                            </button>
                            {categories.map((category) => {
                                const count = menuItems.filter(item => item.category === category).length;
                                // Get subcategories for this category
                                const categorySubcats = Array.from(new Set(
                                    menuItems
                                        .filter(item => item.category === category && item.subcategory)
                                        .map(item => item.subcategory!)
                                ));
                                const orderedSubcats = subcategoryOrder[category] || [];
                                const sortedSubcats = [...new Set([...orderedSubcats, ...categorySubcats])].filter(s => categorySubcats.includes(s));
                                const hasSubcategories = sortedSubcats.length > 0;
                                const isExpanded = expandedCategories.has(category);
                                const isActive = selectedCategory === category;

                                return (
                                    <div key={category}>
                                        <button
                                            onClick={() => {
                                                if (hasSubcategories) {
                                                    setExpandedCategories(prev => {
                                                        const newSet = new Set(prev);
                                                        if (newSet.has(category)) {
                                                            newSet.delete(category);
                                                        } else {
                                                            newSet.add(category);
                                                        }
                                                        return newSet;
                                                    });
                                                    setSelectedCategory(category);
                                                    setSelectedSubcategory(null);
                                                } else {
                                                    setSelectedCategory(category);
                                                    setSelectedSubcategory(null);
                                                    setMobileCategoryModalOpen(false);
                                                }
                                            }}
                                            className={`w-full text-left px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors flex justify-between items-center ${isActive && !selectedSubcategory ? 'bg-gray-800' : isActive && selectedSubcategory ? 'bg-gray-800/50' : ''
                                                }`}
                                        >
                                            <span className="font-medium flex items-center gap-2">
                                                {hasSubcategories && (
                                                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                )}
                                                {getLocalizedCategory(category)}
                                            </span>
                                            <span className="text-sm text-gray-400">{count}</span>
                                        </button>
                                        {/* Subcategory list */}
                                        {hasSubcategories && isExpanded && (
                                            <div className="ml-6 mt-1 space-y-1 border-l border-gray-700 pl-4">
                                                {sortedSubcats.map(subcat => {
                                                    const subcatCount = menuItems.filter(item => item.category === category && item.subcategory === subcat).length;
                                                    return (
                                                        <button
                                                            key={subcat}
                                                            onClick={() => {
                                                                setSelectedCategory(category);
                                                                setSelectedSubcategory(subcat);
                                                                setMobileCategoryModalOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors flex justify-between items-center text-sm ${selectedSubcategory === subcat ? 'bg-gray-800 text-orange-400' : 'text-gray-300'
                                                                }`}
                                                        >
                                                            <span>{getLocalizedSubcategory(category, subcat)}</span>
                                                            <span className="text-xs text-gray-500">{subcatCount}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Tip Selection Dialog */}
            <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Server Tip</DialogTitle>
                        <DialogDescription>
                            Show your appreciation for great service
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Percentage Buttons */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Quick Select</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 18, 0].map((percentage) => (
                                    <Button
                                        key={percentage}
                                        type="button"
                                        variant={selectedTipPercentage === percentage ? "default" : "outline"}
                                        onClick={() => setSelectedTipPercentage(percentage)}
                                        className="h-12"
                                    >
                                        {percentage === 0 ? 'No Tip' : `${percentage}%`}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Amount */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Custom Amount (€)</label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Enter custom tip amount"
                                value={customTipAmount}
                                onChange={(e) => {
                                    setCustomTipAmount(e.target.value);
                                    setSelectedTipPercentage(null);
                                }}
                            />
                        </div>

                        {/* Tip Preview */}
                        {calculatedTip > 0 && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Server Tip:</span>
                                    <span className="text-lg font-bold text-green-600">€{calculatedTip.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setTipDialogOpen(false);
                            setSelectedTipPercentage(null);
                            setCustomTipAmount('');
                            setCalculatedTip(0);
                        }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmBillWithTip}
                            disabled={selectedTipPercentage === null && customTipAmount === ''}
                        >
                            Confirm & Request Bill
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Method Modal */}
            <Dialog open={paymentMethodModalOpen} onOpenChange={setPaymentMethodModalOpen}>
                <DialogContent className="bg-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Payment Method</DialogTitle>
                        <DialogDescription>How would you like to pay?</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-6">
                        <Button
                            variant="outline"
                            className="h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-green-500 hover:bg-green-50"
                            onClick={() => handlePaymentMethodSelect('cash')}
                        >
                            <Banknote className="h-8 w-8 text-green-600" />
                            <span className="font-semibold">Cash</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-blue-500 hover:bg-blue-50"
                            onClick={() => handlePaymentMethodSelect('card')}
                        >
                            <CreditCard className="h-8 w-8 text-blue-600" />
                            <span className="font-semibold">Card</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Toast Notification */}
            {showToast && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5">
                    <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">{toastMessage}</span>
                    </div>
                </div>
            )}
        </div >
    );
}
