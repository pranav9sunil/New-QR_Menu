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
} from 'firebase/firestore';
import type { MenuItem } from '@/types';
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
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function MenuManagementPage() {
    const { restaurantId } = useAuth();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        imageUrl: '',
        dietary: [] as string[],
        spiceLevel: '0',
        isChefSpecial: false,
        allergens: '',
    });

    useEffect(() => {
        if (restaurantId) {
            loadMenuItems();
        }
    }, [restaurantId]);

    const loadMenuItems = async () => {
        if (!restaurantId) return;

        try {
            const menuRef = collection(db, 'menu_items');
            const q = query(menuRef, where('restaurantId', '==', restaurantId));
            const querySnapshot = await getDocs(q);

            const items: MenuItem[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MenuItem);
            });

            setMenuItems(items);
        } catch (error) {
            console.error('Error loading menu items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;

        try {
            const itemData = {
                restaurantId,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                category: formData.category,
                imageUrl: formData.imageUrl,
                dietary: formData.dietary,
                spiceLevel: parseInt(formData.spiceLevel),
                isChefSpecial: formData.isChefSpecial,
                allergens: formData.allergens.split(',').map(s => s.trim()).filter(s => s),
                isAvailable: true,
                createdAt: new Date(),
            };

            if (editingItem) {
                await updateDoc(firestoreDoc(db, 'menu_items', editingItem.id), itemData);
            } else {
                await addDoc(collection(db, 'menu_items'), itemData);
            }

            await loadMenuItems();
            resetForm();
        } catch (error) {
            console.error('Error saving menu item:', error);
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

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            category: '',
            imageUrl: '',
            dietary: [],
            spiceLevel: '0',
            isChefSpecial: false,
            allergens: '',
        });
        setEditingItem(null);
        setDialogOpen(false);
    };

    const startEdit = (item: MenuItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description,
            price: item.price.toString(),
            category: item.category,
            imageUrl: item.imageUrl || '',
            dietary: item.dietary || [],
            spiceLevel: (item.spiceLevel || 0).toString(),
            isChefSpecial: item.isChefSpecial || false,
            allergens: (item.allergens || []).join(', '),
        });
        setDialogOpen(true);
    };

    const categories = Array.from(new Set(menuItems.map((item) => item.category)));

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
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Menu Item
                </Button>
            </div>

            {menuItems.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <p>No menu items yet. Click "Add Menu Item" to get started.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {categories.length > 0 ? (
                        categories.map((category) => (
                            <div key={category}>
                                <h2 className="text-2xl font-semibold mb-4">{category}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {menuItems
                                        .filter((item) => item.category === category)
                                        .map((item) => (
                                            <Card key={item.id} className="hover:shadow-lg transition-shadow">
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <CardTitle className="text-lg">{item.name}</CardTitle>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => startEdit(item)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive"
                                                                onClick={() => deleteMenuItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground mb-3">
                                                        {item.description}
                                                    </p>
                                                    <p className="text-lg font-bold text-primary">
                                                        ${item.price.toFixed(2)}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {menuItems.map((item) => (
                                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-lg">{item.name}</CardTitle>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => startEdit(item)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => deleteMenuItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                                        <p className="text-lg font-bold text-primary">${item.price.toFixed(2)}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="bg-white">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
                        <DialogDescription>
                            {editingItem ? 'Update the menu item details' : 'Add a new item to your menu'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
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

                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                required
                                placeholder="e.g., Appetizers, Entrees, Desserts"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Image URL</Label>
                            <Input
                                id="imageUrl"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                placeholder="https://example.com/image.jpg"
                            />
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
                                {['vegetarian', 'vegan', 'gluten-free'].map((tag) => (
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                            <Button type="submit">{editingItem ? 'Update' : 'Add'} Item</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
