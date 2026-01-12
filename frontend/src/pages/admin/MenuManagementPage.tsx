import { useState, useEffect } from 'react';
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
    doc as firestoreDoc,
    setDoc,
    getDoc,
} from 'firebase/firestore';
import type { MenuItem, CustomizationGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Settings2, X, Upload } from 'lucide-react';
import MenuStructureDialog from '@/components/admin/MenuStructureDialog';
import { Switch } from '@/components/ui/switch';

export default function MenuManagementPage() {
    const { restaurantId } = useAuth();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [subcategoryOrder, setSubcategoryOrder] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [structureDialogOpen, setStructureDialogOpen] = useState(false);
    const [translationsDialogOpen, setTranslationsDialogOpen] = useState(false);
    const [categoryTranslations, setCategoryTranslations] = useState<Record<string, { es?: string }>>({});
    const [subcategoryTranslations, setSubcategoryTranslations] = useState<Record<string, { es?: string }>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        subcategory: '',
        imageUrl: '',
        dietary: [] as string[],
        spiceLevel: '0',
        isChefSpecial: false,
        allergens: '',
        customizationOptions: [] as CustomizationGroup[],
        // Spanish translations
        nameEs: '',
        descriptionEs: '',
    });

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const loadData = async () => {
        if (!restaurantId) return;

        try {
            // Load Menu Items
            const menuRef = collection(db, 'menu_items');
            const q = query(menuRef, where('restaurantId', '==', restaurantId));
            const querySnapshot = await getDocs(q);

            const items: MenuItem[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MenuItem);
            });

            // Sort items by order if available
            items.sort((a, b) => (a.order || 0) - (b.order || 0));
            setMenuItems(items);

            // Load Category and Subcategory Order
            const restaurantRef = firestoreDoc(db, 'restaurants', restaurantId);
            const restaurantSnap = await getDoc(restaurantRef);

            if (restaurantSnap.exists()) {
                const data = restaurantSnap.data() as any;
                if (data.categoryOrder) {
                    setCategoryOrder(data.categoryOrder);
                }
                if (data.subcategoryOrder) {
                    setSubcategoryOrder(data.subcategoryOrder);
                }
                if (data.categoryTranslations) {
                    setCategoryTranslations(data.categoryTranslations);
                }
                if (data.subcategoryTranslations) {
                    setSubcategoryTranslations(data.subcategoryTranslations);
                }
            } else {
                // Initial category order from items
                const cats = Array.from(new Set(items.map(i => i.category))).sort();
                setCategoryOrder(cats);
            }

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    /**
     * Converts an image file to a compressed base64 data URL.
     * This stores the image directly in Firestore, bypassing Firebase Storage and CORS.
     * @param file - The image file to convert
     * @param maxWidth - Maximum width for compression (default: 800px)
     * @param quality - JPEG quality 0-1 (default: 0.8 for 80% quality)
     */
    const convertImageToDataUrl = (file: File, maxWidth = 800, quality = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for resizing
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw and compress
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG data URL with specified quality
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    console.log(`Image converted: ${img.width}x${img.height} -> ${width}x${height}, size: ${(dataUrl.length / 1024).toFixed(0)}KB`);

                    resolve(dataUrl);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;

        try {
            setUploading(true);
            console.log('Submitting item...', { formData, imageFile });
            let finalImageUrl = formData.imageUrl;

            if (imageFile) {
                console.log('Converting image to data URL...');
                try {
                    const dataUrl = await convertImageToDataUrl(imageFile);
                    finalImageUrl = dataUrl;
                    console.log('Image converted successfully');
                } catch (err) {
                    console.error('Image conversion failed:', err);
                    alert('Failed to process the image. Please try a different image.');
                    setUploading(false);
                    return;
                }
            }

            const parsedPrice = parseFloat(formData.price);
            if (isNaN(parsedPrice)) {
                alert('Invalid price value');
                setUploading(false);
                return;
            }

            const itemData = {
                restaurantId,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                category: formData.category,
                subcategory: formData.subcategory || null, // Optional
                imageUrl: finalImageUrl,
                dietary: formData.dietary,
                spiceLevel: parseInt(formData.spiceLevel),
                isChefSpecial: formData.isChefSpecial,
                allergens: formData.allergens.split(',').map(s => s.trim()).filter(s => s),
                customizationOptions: formData.customizationOptions,
                isAvailable: true,
                createdAt: new Date(),
                order: menuItems.length, // Append to end
                // Spanish translations
                translations: {
                    es: {
                        name: formData.nameEs || undefined,
                        description: formData.descriptionEs || undefined,
                    }
                }
            };

            if (editingItem) {
                console.log('Updating existing item:', editingItem.id);
                await updateDoc(firestoreDoc(db, 'menu_items', editingItem.id), itemData);
            } else {
                console.log('Adding new item...');
                await addDoc(collection(db, 'menu_items'), itemData);

                // Add category to order if new
                let newCategoryOrder = categoryOrder;
                let newSubcategoryOrder = subcategoryOrder;
                let dataChanged = false;

                if (!categoryOrder.includes(formData.category)) {
                    newCategoryOrder = [...categoryOrder, formData.category];
                    setCategoryOrder(newCategoryOrder);
                    dataChanged = true;
                }

                // Add subcategory to order if new and present
                if (formData.subcategory) {
                    const currentSubs = subcategoryOrder[formData.category] || [];
                    if (!currentSubs.includes(formData.subcategory)) {
                        newSubcategoryOrder = {
                            ...subcategoryOrder,
                            [formData.category]: [...currentSubs, formData.subcategory]
                        };
                        setSubcategoryOrder(newSubcategoryOrder);
                        dataChanged = true;
                    }
                }

                if (dataChanged) {
                    console.log('Updating restaurant document for orders...');
                    await setDoc(firestoreDoc(db, 'restaurants', restaurantId), {
                        categoryOrder: newCategoryOrder,
                        subcategoryOrder: newSubcategoryOrder
                    }, { merge: true });
                }
            }

            console.log('Reloading data...');
            await loadData();
            console.log('Success! Resetting form.');
            resetForm();
        } catch (error) {
            console.error('Error saving menu item:', error);
            alert(`Error saving menu item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    const deleteMenuItem = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await deleteDoc(firestoreDoc(db, 'menu_items', id));
            setMenuItems(menuItems.filter((item) => item.id !== id));
        } catch (error) {
            console.error('Error deleting menu item:', error);
        }
    };

    const toggleAvailability = async (item: MenuItem) => {
        try {
            const newStatus = !item.isAvailable;
            // Optimistic update
            setMenuItems(menuItems.map(i => i.id === item.id ? { ...i, isAvailable: newStatus } : i));

            await updateDoc(firestoreDoc(db, 'menu_items', item.id), {
                isAvailable: newStatus
            });
        } catch (error) {
            console.error('Error toggling availability:', error);
            // Revert on error
            setMenuItems(menuItems.map(i => i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i));
            alert('Failed to update availability');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            category: '',
            subcategory: '',
            imageUrl: '',
            dietary: [],
            spiceLevel: '0',
            isChefSpecial: false,
            allergens: '',
            customizationOptions: [],
            nameEs: '',
            descriptionEs: '',
        });
        setEditingItem(null);
        setDialogOpen(false);
        setImageFile(null);
        setImagePreview(null);
    };

    const addCustomizationGroup = () => {
        const newGroup: CustomizationGroup = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            type: 'single',
            minSelection: 1,
            maxSelection: 1,
            options: [],
        };
        setFormData({
            ...formData,
            customizationOptions: [...(formData.customizationOptions || []), newGroup],
        });
    };

    const removeCustomizationGroup = (groupId: string) => {
        setFormData({
            ...formData,
            customizationOptions: formData.customizationOptions.filter((g) => g.id !== groupId),
        });
    };

    const updateCustomizationGroup = (groupId: string, field: keyof CustomizationGroup, value: any) => {
        setFormData({
            ...formData,
            customizationOptions: formData.customizationOptions.map((g) => {
                if (g.id === groupId) {
                    const updated = { ...g, [field]: value };
                    if (field === 'type') {
                        if (value === 'single') {
                            updated.minSelection = 1;
                            updated.maxSelection = 1;
                        } else {
                            updated.minSelection = 0;
                            updated.maxSelection = undefined;
                        }
                    }
                    return updated;
                }
                return g;
            }),
        });
    };

    const addOptionToGroup = (groupId: string) => {
        setFormData({
            ...formData,
            customizationOptions: formData.customizationOptions.map((g) => {
                if (g.id === groupId) {
                    return {
                        ...g,
                        options: [...g.options, { name: '', price: 0 }],
                    };
                }
                return g;
            }),
        });
    };

    const removeOptionFromGroup = (groupId: string, optionIndex: number) => {
        setFormData({
            ...formData,
            customizationOptions: formData.customizationOptions.map((g) => {
                if (g.id === groupId) {
                    return {
                        ...g,
                        options: g.options.filter((_, idx) => idx !== optionIndex),
                    };
                }
                return g;
            }),
        });
    };

    const updateOption = (
        groupId: string,
        optionIndex: number,
        field: keyof import('@/types').CustomizationOption,
        value: any
    ) => {
        setFormData({
            ...formData,
            customizationOptions: formData.customizationOptions.map((g) => {
                if (g.id === groupId) {
                    const newOptions = [...g.options];
                    newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
                    return { ...g, options: newOptions };
                }
                return g;
            }),
        });
    };

    const startEdit = (item: MenuItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description,
            price: item.price.toString(),
            category: item.category,
            subcategory: item.subcategory || '',
            imageUrl: item.imageUrl || '',
            dietary: item.dietary || [],
            spiceLevel: (item.spiceLevel || 0).toString(),
            isChefSpecial: item.isChefSpecial || false,
            allergens: (item.allergens || []).join(', '),
            customizationOptions: item.customizationOptions || [],
            nameEs: item.translations?.es?.name || '',
            descriptionEs: item.translations?.es?.description || '',
        });
        setImagePreview(item.imageUrl || null);
        setDialogOpen(true);
    };

    // Ensure all categories from items are in categoryOrder
    const itemCategories = Array.from(new Set(menuItems.map((item) => item.category)));
    const categories = Array.from(new Set([...categoryOrder, ...itemCategories]));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Menu Management</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStructureDialogOpen(true)}>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Edit Structure
                    </Button>
                    <Button variant="outline" onClick={() => setTranslationsDialogOpen(true)}>
                        🌐 Translations
                    </Button>
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Menu Item
                    </Button>
                </div>
            </div>

            {menuItems.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <p>No menu items yet. Click "Add Menu Item" to get started.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {categories.map((category) => (
                        <div key={category} className="bg-gray-50/50 p-4 rounded-lg border">
                            <h2 className="text-2xl font-semibold mb-4">{category}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(() => {
                                    const items = menuItems.filter((item) => item.category === category);
                                    // Group by subcategory
                                    const grouped: Record<string, MenuItem[]> = { 'Other': [] };
                                    const subcats = subcategoryOrder[category] || [];

                                    // Initialize known subcategories in order
                                    subcats.forEach(sub => grouped[sub] = []);

                                    items.forEach(item => {
                                        if (item.subcategory && (subcats.includes(item.subcategory) || grouped[item.subcategory])) {
                                            if (!grouped[item.subcategory]) grouped[item.subcategory] = [];
                                            grouped[item.subcategory].push(item);
                                        } else {
                                            grouped['Other'].push(item);
                                        }
                                    });

                                    // Keys to display: Subcategories first, then Other (if any)
                                    const displayKeys = [...subcats, 'Other'].filter(k => k === 'Other' ? grouped['Other'].length > 0 : (grouped[k] && grouped[k].length > 0));

                                    // If no subcategories at all, just show flat list logic (by handling 'Other' as implicit root)
                                    if (subcats.length === 0) {
                                        return items.map(item => (
                                            <MenuItemCard
                                                key={item.id}
                                                item={item}
                                                onEdit={startEdit}
                                                onDelete={deleteMenuItem}
                                                onToggleAvailability={toggleAvailability}
                                            />
                                        ));
                                    }

                                    return (
                                        <div className="col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 gap-6">
                                            {displayKeys.map(key => (
                                                <div key={key} className="space-y-3">
                                                    {key !== 'Other' && (
                                                        <h3 className="text-lg font-medium text-gray-600 border-b pb-1">{key}</h3>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {grouped[key].map(item => (
                                                            <MenuItemCard
                                                                key={item.id}
                                                                item={item}
                                                                onEdit={startEdit}
                                                                onDelete={deleteMenuItem}
                                                                onToggleAvailability={toggleAvailability}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {restaurantId && (
                <MenuStructureDialog
                    open={structureDialogOpen}
                    onOpenChange={(open) => {
                        setStructureDialogOpen(open);
                        if (!open) {
                            loadData();
                        }
                    }}
                    restaurantId={restaurantId}
                    initialMenuItems={menuItems}
                    initialCategoryOrder={categories}
                    initialSubcategoryOrder={subcategoryOrder}
                />
            )}

            {/* Category Translations Dialog */}
            <Dialog open={translationsDialogOpen} onOpenChange={setTranslationsDialogOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-white">
                    <DialogHeader>
                        <DialogTitle>🌐 Category Translations</DialogTitle>
                        <DialogDescription>
                            Add Spanish translations for your categories and subcategories.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Categories */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Categories</h3>
                            {categoryOrder.map(category => (
                                <div key={category} className="grid grid-cols-2 gap-3 items-center">
                                    <div className="text-sm font-medium">🇬🇧 {category}</div>
                                    <Input
                                        placeholder="Spanish name..."
                                        value={categoryTranslations[category]?.es || ''}
                                        onChange={(e) => setCategoryTranslations({
                                            ...categoryTranslations,
                                            [category]: { es: e.target.value }
                                        })}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Subcategories */}
                        {Object.entries(subcategoryOrder).some(([_, subs]) => subs.length > 0) && (
                            <div className="space-y-4 border-t pt-4">
                                <h3 className="font-semibold text-lg">Subcategories</h3>
                                {Object.entries(subcategoryOrder).map(([category, subs]) =>
                                    subs.map(sub => {
                                        const key = `${category}:${sub}`;
                                        return (
                                            <div key={key} className="grid grid-cols-2 gap-3 items-center">
                                                <div className="text-sm font-medium">
                                                    🇬🇧 {sub} <span className="text-gray-400 text-xs">({category})</span>
                                                </div>
                                                <Input
                                                    placeholder="Spanish name..."
                                                    value={subcategoryTranslations[key]?.es || ''}
                                                    onChange={(e) => setSubcategoryTranslations({
                                                        ...subcategoryTranslations,
                                                        [key]: { es: e.target.value }
                                                    })}
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTranslationsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={async () => {
                            if (!restaurantId) return;
                            try {
                                await setDoc(firestoreDoc(db, 'restaurants', restaurantId), {
                                    categoryTranslations,
                                    subcategoryTranslations
                                }, { merge: true });
                                setTranslationsDialogOpen(false);
                                alert('Translations saved!');
                            } catch (error) {
                                console.error('Error saving translations:', error);
                                alert('Failed to save translations');
                            }
                        }}>
                            Save Translations
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="bg-white max-h-[80vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
                        <DialogDescription>
                            {editingItem ? 'Update the menu item details' : 'Add a new item to your menu'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">🇬🇧 Name (English)</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">🇬🇧 Description (English)</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>

                        {/* Spanish Translations */}
                        <div className="border-t pt-4 mt-4">
                            <p className="text-sm font-medium text-gray-500 mb-3">🇪🇸 Spanish Translation (Optional)</p>
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="nameEs">Name (Spanish)</Label>
                                    <Input
                                        id="nameEs"
                                        value={formData.nameEs}
                                        onChange={(e) => setFormData({ ...formData, nameEs: e.target.value })}
                                        placeholder="Leave empty to use English"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="descriptionEs">Description (Spanish)</Label>
                                    <Input
                                        id="descriptionEs"
                                        value={formData.descriptionEs}
                                        onChange={(e) => setFormData({ ...formData, descriptionEs: e.target.value })}
                                        placeholder="Leave empty to use English"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="price">Price</Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <select
                                    id="category"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">Select a category...</option>
                                    <option value="Starters">Starters</option>
                                    <option value="Tandoori Starters">Tandoori Starters</option>
                                    <option value="Vegetarians">Vegetarians</option>
                                    <option value="Chicken">Chicken</option>
                                    <option value="Lamb/Mutton">Lamb/Mutton</option>
                                    <option value="Fish">Fish</option>
                                    <option value="Rice">Rice</option>
                                    <option value="Breads">Breads</option>
                                    <option value="Biriyani's">Biriyani's</option>
                                    <option value="Thali's">Thali's</option>
                                    <option value="Soups">Soups</option>
                                    <option value="Extras">Extras</option>
                                    <option value="Desserts">Desserts</option>
                                    <option value="Drinks">Drinks</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subcategory">Subcategory (Optional)</Label>
                                <Input
                                    id="subcategory"
                                    value={formData.subcategory}
                                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                    placeholder="e.g., Beers"
                                    list="subcategories-list"
                                />
                                <datalist id="subcategories-list">
                                    {(subcategoryOrder[formData.category] || []).map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Item Image</Label>
                            <div className="flex items-center gap-4">
                                <div
                                    className="relative w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                >
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-400">
                                            <Upload className="h-6 w-6 mb-1" />
                                            <span className="text-xs">Upload</span>
                                        </div>
                                    )}
                                    <input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                </div>
                                {imagePreview && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setImageFile(null);
                                            setImagePreview(null);
                                            setFormData({ ...formData, imageUrl: '' });
                                        }}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Remove
                                    </Button>
                                )}
                                <div className="flex-1 text-xs text-muted-foreground">
                                    <p>Upload a high-quality image of the dish.</p>
                                    <p>Recommended size: 800x600px</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="spiceLevel">Spice Level (0-3)</Label>
                                <select
                                    id="spiceLevel"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.spiceLevel}
                                    onChange={(e) => setFormData({ ...formData, spiceLevel: e.target.value })}
                                >
                                    <option value="0">No Spice</option>
                                    <option value="1">Mild</option>
                                    <option value="2">Medium</option>
                                    <option value="3">Hot</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="allergens">Allergens (comma separated)</Label>
                                <Input
                                    id="allergens"
                                    value={formData.allergens}
                                    onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                                    placeholder="e.g. Nuts, Dairy, Soy"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Dietary Tags</Label>
                            <div className="flex gap-4">
                                {['vegetarian', 'vegan', 'gluten-free', 'non-vegetarian', 'dairy', 'gluten'].map((tag) => (
                                    <label key={tag} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.dietary.includes(tag)}
                                            onChange={(e) => {
                                                const newDietary = e.target.checked
                                                    ? [...formData.dietary, tag]
                                                    : formData.dietary.filter((t) => t !== tag);
                                                setFormData({ ...formData, dietary: newDietary });
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="capitalize">{tag}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="isChefSpecial"
                                checked={formData.isChefSpecial}
                                onChange={(e) => setFormData({ ...formData, isChefSpecial: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="isChefSpecial">Chef's Special</Label>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Customization Options</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addCustomizationGroup}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Customization Group
                                </Button>
                            </div>

                            {formData.customizationOptions?.map((group, groupIndex) => (
                                <Card key={group.id || groupIndex} className="p-4 border border-gray-200">
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Group Name</Label>
                                                        <Input
                                                            value={group.name}
                                                            onChange={(e) =>
                                                                updateCustomizationGroup(group.id, 'name', e.target.value)
                                                            }
                                                            placeholder="e.g. Size, Toppings"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Selection Type</Label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                            value={group.type}
                                                            onChange={(e) =>
                                                                updateCustomizationGroup(group.id, 'type', e.target.value)
                                                            }
                                                        >
                                                            <option value="single">Single Selection (Radio)</option>
                                                            <option value="multiple">Multiple Selection (Checkbox)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => removeCustomizationGroup(group.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Options</Label>
                                            {group.options.map((option, optIndex) => (
                                                <div key={optIndex} className="flex items-center gap-2">
                                                    <Input
                                                        value={option.name}
                                                        onChange={(e) =>
                                                            updateOption(group.id, optIndex, 'name', e.target.value)
                                                        }
                                                        placeholder="Option Name"
                                                        className="flex-1"
                                                    />
                                                    <div className="relative w-24">
                                                        <span className="absolute left-2 top-2.5 text-muted-foreground">
                                                            €
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            value={option.price}
                                                            onChange={(e) =>
                                                                updateOption(
                                                                    group.id,
                                                                    optIndex,
                                                                    'price',
                                                                    parseFloat(e.target.value) || 0
                                                                )
                                                            }
                                                            className="pl-6"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeOptionFromGroup(group.id, optIndex)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-full mt-2 border-dashed"
                                                onClick={() => addOptionToGroup(group.id)}
                                            >
                                                <Plus className="h-3 w-3 mr-2" />
                                                Add Option
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={uploading}>
                                {uploading ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MenuItemCard({
    item,
    onEdit,
    onDelete,
    onToggleAvailability
}: {
    item: MenuItem,
    onEdit: (i: MenuItem) => void,
    onDelete: (id: string) => void,
    onToggleAvailability: (item: MenuItem) => void
}) {
    return (
        <Card className={`hover:shadow-lg transition-shadow h-full ${!item.isAvailable ? 'opacity-75 bg-gray-50' : ''}`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-1" title={item.name}>
                        {item.name}
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                        <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                                checked={item.isAvailable ?? true}
                                onCheckedChange={() => onToggleAvailability(item)}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onEdit(item)}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => onDelete(item.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 min-h-[2.5rem]">
                    {item.description}
                </p>
                <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-primary">
                        €{item.price.toFixed(2)}
                    </p>
                    {item.imageUrl && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
