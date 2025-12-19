import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronRight, Edit2, Check, X } from 'lucide-react';
import type { MenuItem } from '@/types';
import { db } from '@/config/firebase';
import { doc, writeBatch } from 'firebase/firestore';

interface MenuStructureDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    restaurantId: string;
    initialMenuItems: MenuItem[];
    initialCategoryOrder: string[];
    initialSubcategoryOrder?: Record<string, string[]>;
}

// --- Helper ID Functions ---
const PREFIX = {
    CATEGORY: 'cat:',
    SUBCATEGORY: 'sub:',
    ITEM: 'item:',
};

const getId = (type: 'category' | 'subcategory' | 'item', id: string) => {
    if (type === 'subcategory') return `${PREFIX.SUBCATEGORY}${id}`;
    if (type === 'category') return `${PREFIX.CATEGORY}${id}`;
    return `${PREFIX.ITEM}${id}`;
};

const parseId = (id: string) => {
    if (id.startsWith(PREFIX.SUBCATEGORY)) return { type: 'subcategory', id: id.replace(PREFIX.SUBCATEGORY, '') };
    if (id.startsWith(PREFIX.CATEGORY)) return { type: 'category', id: id.replace(PREFIX.CATEGORY, '') };
    if (id.startsWith(PREFIX.ITEM)) return { type: 'item', id: id.replace(PREFIX.ITEM, '') };
    return { type: 'unknown', id };
};

// --- Sortable Item Component ---
function SortableItem({ item }: { item: MenuItem }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: getId('item', item.id), data: { type: 'item', item } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 bg-white rounded border mb-2 ml-6">
            <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">€{item.price.toFixed(2)}</span>
        </div>
    );
}

// --- Sortable Category Component ---
function SortableCategoryRow({
    category,
    items,
    isOpen,
    onToggle,
    onRename
}: {
    category: string,
    items: MenuItem[],
    isOpen: boolean,
    onToggle: () => void,
    onRename: (oldName: string, newName: string) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: getId('category', category), data: { type: 'category', category } });

    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(category);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent toggling accordion
        onRename(category, newName);
        setIsRenaming(false);
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2 border rounded-lg bg-gray-50 overflow-hidden">
            <div className="flex items-center gap-2 p-3 bg-white border-b">
                <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-gray-100 rounded">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>

                <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6 p-0 hover:bg-gray-100 rounded">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>

                {isRenaming ? (
                    <form onSubmit={handleRenameSubmit} className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-8 flex-1"
                            autoFocus
                            onKeyDown={(e) => e.stopPropagation()} // Allow typing without triggering drag
                        />
                        <Button type="submit" size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600">
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => setIsRenaming(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </form>
                ) : (
                    <div className="flex items-center gap-2 flex-1 group">
                        <span className="font-semibold">{category}</span>
                        <span className="text-xs text-muted-foreground">({items.length} items)</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsRenaming(true);
                            }}
                        >
                            <Edit2 className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="p-2 bg-gray-50/50">
                    <SortableContext items={items.map(i => getId('item', i.id))} strategy={verticalListSortingStrategy}>
                        {items.map(item => (
                            <SortableItem key={item.id} item={item} />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}

export default function MenuStructureDialog({
    open,
    onOpenChange,
    restaurantId,
    initialMenuItems,
    initialCategoryOrder,
    initialSubcategoryOrder = {},
}: MenuStructureDialogProps) {
    const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
    const [categories, setCategories] = useState<string[]>(initialCategoryOrder);
    // Track subcategories as fully qualified IDs internally? No, keep logic simple, map to display.
    const [subcategories, setSubcategories] = useState<Record<string, string[]>>(initialSubcategoryOrder);

    // UI State
    const [openCategories, setOpenCategories] = useState<string[]>([]);
    const [openSubcategories, setOpenSubcategories] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setItems(initialMenuItems);
            setCategories(initialCategoryOrder);
            setSubcategories(initialSubcategoryOrder);
        }
    }, [initialMenuItems, initialCategoryOrder, initialSubcategoryOrder, open]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = () => {
        // activeId is not used for logic
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        const parsedActive = parseId(activeIdStr);
        const parsedOver = parseId(overIdStr);

        const activeId = parsedActive.id;
        const overId = parsedOver.id;
        const activeType = parsedActive.type;
        const overType = parsedOver.type;

        if (activeIdStr === overIdStr) return;

        // 1. Reordering Categories
        if (activeType === 'category' && overType === 'category') {
            const oldIndex = categories.indexOf(activeId);
            const newIndex = categories.indexOf(overId);
            if (oldIndex !== -1 && newIndex !== -1) {
                setCategories(arrayMove(categories, oldIndex, newIndex));
            }
            return;
        }

        // 2. Reordering Subcategories (within same category)
        if (activeType === 'subcategory' && overType === 'subcategory') {
            // We need to know which category these subcategories belong to. 
            // The ID structure `sub:UniqueSubID` or `sub:Category-SubName`? 
            // Currently `parseId` just strips prefix.
            // If sub ID is `Category-SubName`, we can split it.
            // But we used `${category}-${sub}` as the ID component in the render loop.
            // Let's ensure the ID we constructed in render is passed correctly.

            // In render loop below: `getId('subcategory', subFullId)` where subFullId is `${category}-${sub}`
            // So parsed ID is `${category}-${sub}`.

            // Wait, standard `getId` takes `id`. If we use a composite key, we must be careful.
            // Let's look at `SortableSubcategoryRow` usage below.

            // Logic:
            const activeData = active.data.current;
            const overData = over.data.current;

            if (activeData?.type === 'subcategory' && overData?.type === 'subcategory') {
                const activeCat = activeData.category;
                const overCat = overData.category;
                const activeSub = activeData.subcategory;
                const overSub = overData.subcategory;

                if (activeCat === overCat) {
                    const currentSubs = subcategories[activeCat] || [];
                    const oldIndex = currentSubs.indexOf(activeSub);
                    const newIndex = currentSubs.indexOf(overSub);

                    if (oldIndex !== -1 && newIndex !== -1) {
                        setSubcategories({
                            ...subcategories,
                            [activeCat]: arrayMove(currentSubs, oldIndex, newIndex)
                        });
                    }
                }
            }
            return;
        }

        // 3. Reordering Items
        if (activeType === 'item') {
            const activeItem = items.find(i => i.id === activeId);
            if (!activeItem) return;

            // Determine target context
            let targetCategory = activeItem.category;
            let targetSubcategory = activeItem.subcategory || null; // Normalize undefined to null

            // If dropped over another ITEM
            if (overType === 'item') {
                const overItem = items.find(i => i.id === overId);
                if (overItem) {
                    targetCategory = overItem.category;
                    targetSubcategory = overItem.subcategory || null;
                }
            }
            // If dropped over a SUBCATEGORY
            else if (overType === 'subcategory') {
                const overData = over.data.current;
                if (overData) {
                    targetCategory = overData.category;
                    targetSubcategory = overData.subcategory;
                }
            }
            // If dropped over a CATEGORY
            else if (overType === 'category') {
                targetCategory = overId;
                targetSubcategory = null; // Move to root
            }

            // Restrict dragging items to stay within the SAME CATEGORY for now
            if (targetCategory !== activeItem.category) return;

            // Update item's subcategory if changed
            // NOTE: We update locally. 
            let newItems = items.map(i => i.id === activeId ? { ...i, subcategory: targetSubcategory || undefined } : i);

            // Filter items in the TARGET context
            const contextItems = newItems.filter(i =>
                i.category === targetCategory && (i.subcategory || null) === targetSubcategory
            );

            const oldIndex = contextItems.findIndex(i => i.id === activeId);
            // If dragging to empty subcategory/category, overId might be container ID
            let newIndex = contextItems.findIndex(i => i.id === overId);

            if (overType === 'subcategory' || overType === 'category') {
                newIndex = contextItems.length; // End of list
            }

            if (oldIndex !== -1 && newIndex !== -1) {
                const reorderedContextItems = arrayMove(contextItems, oldIndex, newIndex);

                // Assign new order values
                reorderedContextItems.forEach((item, index) => {
                    const globalIndex = newItems.findIndex(i => i.id === item.id);
                    if (globalIndex !== -1) {
                        newItems[globalIndex] = { ...newItems[globalIndex], order: index };
                    }
                });

                newItems.sort((a, b) => (a.order || 0) - (b.order || 0));
                setItems(newItems);
            } else if ((activeItem.subcategory || null) !== targetSubcategory) {
                // Moved context but no reorder match (dropped on container)
                const maxOrder = Math.max(...contextItems.map(i => i.order || 0), 0);
                const globalIndex = newItems.findIndex(i => i.id === activeId);
                if (globalIndex !== -1) {
                    newItems[globalIndex] = { ...newItems[globalIndex], order: maxOrder + 1 };
                }
                setItems(newItems);
            }
        }
    };

    const toggleCategory = (category: string) => {
        setOpenCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const toggleSubcategory = (subcategoryFullId: string) => {
        setOpenSubcategories(prev =>
            prev.includes(subcategoryFullId)
                ? prev.filter(c => c !== subcategoryFullId)
                : [...prev, subcategoryFullId]
        );
    };

    const handleCategoryRename = (oldName: string, newName: string) => {
        if (!restaurantId || oldName === newName || !newName.trim()) return;

        // 1. Update items category
        setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: newName } : i));

        // 2. Update category list
        setCategories(prev => prev.map(c => c === oldName ? newName : c));

        // 3. Update subcategory map key
        const subs = subcategories[oldName];
        if (subs) {
            const newSubs = { ...subcategories };
            delete newSubs[oldName];
            newSubs[newName] = subs;
            setSubcategories(newSubs);
        }
    };

    const handleAddSubcategory = (category: string) => {
        if (!newSubcategoryName.trim()) return;

        const currentSubs = subcategories[category] || [];
        if (!currentSubs.includes(newSubcategoryName.trim())) {
            setSubcategories({
                ...subcategories,
                [category]: [...currentSubs, newSubcategoryName.trim()]
            });
        }
        setNewSubcategoryName('');
        setAddingSubcategoryTo(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);

            // 1. Save Category and Subcategory Order
            const restaurantRef = doc(db, 'restaurants', restaurantId);
            batch.set(restaurantRef, {
                categoryOrder: categories,
                subcategoryOrder: subcategories
            }, { merge: true });

            // 2. Save items
            items.forEach((item) => {
                if (!item.id) return;
                const ref = doc(db, 'menu_items', item.id);
                // Explicitly send subcategory (or null/delete if undefined?) 
                // Firestore update needs undefined fields to be handled carefully if we want to delete them.
                // But here we likely just want to set it to string or null.
                batch.update(ref, {
                    category: item.category,
                    subcategory: item.subcategory || null,
                    order: typeof item.order === 'number' ? item.order : 0
                });
            });

            await batch.commit();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error saving structure:', error);
            alert(`Failed to save changes: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Derived state for display
    const itemsByCategory: Record<string, MenuItem[]> = {};
    categories.forEach(cat => {
        itemsByCategory[cat] = items.filter(i => i.category === cat);
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col bg-white sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Menu Structure</DialogTitle>
                    <DialogDescription>
                        Rearrange categories, subcategories, and items.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={categories.map(c => getId('category', c))} strategy={verticalListSortingStrategy}>
                            {categories.map((category) => {
                                const categoryItems = itemsByCategory[category] || [];
                                const categorySubs = subcategories[category] || [];

                                // Items not in any subcategory
                                const rootItems = categoryItems.filter(i => !i.subcategory);

                                return (
                                    <div key={category} className="mb-4 border rounded-lg bg-gray-50 overflow-hidden">
                                        {/* Category Header */}
                                        <SortableCategoryRow
                                            category={category}
                                            items={categoryItems} // for count only
                                            isOpen={openCategories.includes(category)}
                                            onToggle={() => toggleCategory(category)}
                                            onRename={handleCategoryRename}
                                        />

                                        {openCategories.includes(category) && (
                                            <div className="p-2 bg-gray-100/50 space-y-2">
                                                {/* Add Subcategory Controls */}
                                                <div className="flex items-center gap-2 px-2 py-1">
                                                    {addingSubcategoryTo === category ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <Input
                                                                value={newSubcategoryName}
                                                                onChange={e => setNewSubcategoryName(e.target.value)}
                                                                placeholder="New Subcategory Name"
                                                                className="h-8 text-sm"
                                                                autoFocus
                                                            />
                                                            <Button size="sm" onClick={() => handleAddSubcategory(category)}>Add</Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setAddingSubcategoryTo(null)}>Cancel</Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-muted-foreground text-xs"
                                                            onClick={() => setAddingSubcategoryTo(category)}
                                                        >
                                                            + Add Subcategory
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Root Items (No subcategory) */}
                                                <div className="pl-2">
                                                    <SortableContext items={rootItems.map(i => getId('item', i.id))} strategy={verticalListSortingStrategy}>
                                                        {rootItems.map(item => (
                                                            <SortableItem key={item.id} item={item} />
                                                        ))}
                                                    </SortableContext>
                                                </div>

                                                {/* Subcategories */}
                                                <SortableContext items={categorySubs.map(s => getId('subcategory', `${category}-${s}`))} strategy={verticalListSortingStrategy}>
                                                    {categorySubs.map(sub => {
                                                        const subItems = categoryItems.filter(i => i.subcategory === sub);
                                                        const subFullId = `${category}-${sub}`;
                                                        return (
                                                            <div key={sub} className="ml-4 mt-2">
                                                                {/* Subcategory Sortable Row */}
                                                                <SortableSubcategoryRow
                                                                    category={category}
                                                                    subcategory={sub}
                                                                    items={subItems}
                                                                    isOpen={openSubcategories.includes(subFullId)}
                                                                    onToggle={() => toggleSubcategory(subFullId)}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </SortableContext>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span> Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Helper Component for Subcategory ---
function SortableSubcategoryRow({
    category,
    subcategory,
    items,
    isOpen,
    onToggle
}: {
    category: string,
    subcategory: string,
    items: MenuItem[],
    isOpen: boolean,
    onToggle: () => void
}) {
    const subFullId = `${category}-${subcategory}`;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: getId('subcategory', subFullId), data: { type: 'subcategory', category, subcategory } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="border rounded-lg bg-white mb-2 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 p-2 group border-b bg-gray-50/50">
                <div {...attributes} {...listeners} className="cursor-grab hover:bg-gray-200 rounded p-1">
                    <GripVertical className="h-4 w-4 text-gray-500" />
                </div>

                <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6 p-0 hover:bg-gray-200 rounded">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>

                <span className="text-sm font-semibold text-gray-700">{subcategory}</span>
                <span className="text-xs text-muted-foreground ml-auto">({items.length})</span>
            </div>

            {isOpen && (
                <div className="p-2 bg-white">
                    <SortableContext items={items.map(i => getId('item', i.id))} strategy={verticalListSortingStrategy}>
                        {items.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-2 italic border-dashed border rounded">
                                Drop items here
                            </div>
                        ) : (
                            items.map(item => (
                                <SortableItem key={item.id} item={item} />
                            ))
                        )}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}
