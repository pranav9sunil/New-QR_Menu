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
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragOverEvent,
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

// --- Pure UI Components (for Overlay support) ---

function ItemCard({ item, isDragging }: { item: MenuItem; isDragging?: boolean }) {
    return (
        <div
            className={`flex items-center gap-3 p-2 bg-white rounded border mb-2 ml-6 transition-none
                ${isDragging ? 'opacity-30 border-dashed border-blue-400 bg-blue-50/10' : 'shadow-sm'}`}
        >
            <div className="text-muted-foreground">
                <GripVertical className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">€{item.price.toFixed(2)}</span>
        </div>
    );
}

function SubcategoryCard({
    subcategory,
    itemsCount,
    isOpen,
    onToggle,
    isDragging
}: {
    subcategory: string;
    itemsCount: number;
    isOpen: boolean;
    onToggle?: () => void;
    isDragging?: boolean;
}) {
    return (
        <div className={`border rounded-lg bg-white mb-2 overflow-hidden transition-none
            ${isDragging ? 'opacity-30 border-dashed border-blue-400 bg-blue-50/10' : 'shadow-sm'}`}>
            <div className="flex items-center gap-2 p-2 group border-b bg-gray-50/50">
                <div className="p-1">
                    <GripVertical className="h-4 w-4 text-gray-500" />
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-6 w-6 p-0 hover:bg-gray-200 rounded"
                >
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>

                <span className="text-sm font-semibold text-gray-700">{subcategory}</span>
                <span className="text-xs text-muted-foreground ml-auto">({itemsCount})</span>
            </div>
        </div>
    );
}

function CategoryCardHeader({
    category,
    itemsCount,
    isOpen,
    onToggle,
    isRenaming,
    newName,
    setNewName,
    onRenameSubmit,
    setIsRenaming,
    isDragging
}: {
    category: string;
    itemsCount: number;
    isOpen: boolean;
    onToggle: () => void;
    isRenaming?: boolean;
    newName?: string;
    setNewName?: (val: string) => void;
    onRenameSubmit?: (e: React.FormEvent) => void;
    setIsRenaming?: (val: boolean) => void;
    isDragging?: boolean;
}) {
    return (
        <div className={`flex items-center gap-2 p-3 bg-white border-b transition-none
            ${isDragging ? 'opacity-30 bg-blue-50/5' : ''}`}>
            <div className="p-1 hover:bg-gray-100 rounded">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6 p-0 hover:bg-gray-100 rounded">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>

            {isRenaming ? (
                <form onSubmit={onRenameSubmit} className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName!(e.target.value)}
                        className="h-8 flex-1"
                        autoFocus
                    />
                    <Button type="submit" size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600">
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => setIsRenaming!(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </form>
            ) : (
                <div className="flex items-center gap-2 flex-1 group">
                    <span className="font-semibold">{category}</span>
                    <span className="text-xs text-muted-foreground">({itemsCount} items)</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRenaming!(true);
                        }}
                    >
                        <Edit2 className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// --- Sortable Wrapper Components ---

function SortableItem({ item }: { item: MenuItem }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useSortable({ id: getId('item', item.id), data: { type: 'item', item } });

    const style = {
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        // No transition property here ensures "snappy" behavior
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <ItemCard item={item} isDragging={isDragging} />
        </div>
    );
}

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
        isDragging,
    } = useSortable({ id: getId('subcategory', subFullId), data: { type: 'subcategory', category, subcategory } });

    const style = {
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
    };

    return (
        <div ref={setNodeRef} style={style} className="ml-4 mt-2">
            <div {...attributes} {...listeners}>
                <SubcategoryCard
                    subcategory={subcategory}
                    itemsCount={items.length}
                    isOpen={isOpen}
                    onToggle={onToggle}
                    isDragging={isDragging}
                />
            </div>
            {isOpen && (
                <div className="p-2 bg-white">
                    <SortableContext items={items.map(i => getId('item', i.id))} strategy={verticalListSortingStrategy}>
                        {items.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-2 italic border-dashed border rounded ml-6 mb-2">
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

function SortableCategoryRow({
    category,
    items,
    isOpen,
    onToggle,
    onRename,
    rootItems,
    categorySubs,
    openSubcategories,
    toggleSubcategory,
    addingSubcategoryTo,
    setAddingSubcategoryTo,
    newSubcategoryName,
    setNewSubcategoryName,
    handleAddSubcategory
}: {
    category: string,
    items: MenuItem[],
    isOpen: boolean,
    onToggle: () => void,
    onRename: (oldName: string, newName: string) => void,
    rootItems: MenuItem[],
    categorySubs: string[],
    openSubcategories: string[],
    toggleSubcategory: (fullId: string) => void,
    addingSubcategoryTo: string | null,
    setAddingSubcategoryTo: (cat: string | null) => void,
    newSubcategoryName: string,
    setNewSubcategoryName: (val: string) => void,
    handleAddSubcategory: (cat: string) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useSortable({ id: getId('category', category), data: { type: 'category', category } });

    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(category);

    const style = {
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        zIndex: isDragging ? 10 : 1,
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onRename(category, newName);
        setIsRenaming(false);
    };

    return (
        <div ref={setNodeRef} style={style} className={`mb-4 border rounded-lg bg-gray-50 overflow-hidden ${isDragging ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}>
            <div {...attributes} {...listeners}>
                <CategoryCardHeader
                    category={category}
                    itemsCount={items.length}
                    isOpen={isOpen}
                    onToggle={onToggle}
                    isRenaming={isRenaming}
                    newName={newName}
                    setNewName={setNewName}
                    onRenameSubmit={handleRenameSubmit}
                    setIsRenaming={setIsRenaming}
                    isDragging={isDragging}
                />
            </div>

            {isOpen && (
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
                            const subItems = items.filter(i => i.subcategory === sub);
                            return (
                                <SortableSubcategoryRow
                                    key={sub}
                                    category={category}
                                    subcategory={sub}
                                    items={subItems}
                                    isOpen={openSubcategories.includes(`${category}-${sub}`)}
                                    onToggle={() => toggleSubcategory(`${category}-${sub}`)}
                                />
                            );
                        })}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}

// --- Main Component ---

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
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;
        if (activeIdStr === overIdStr) return;

        const parsedActive = parseId(activeIdStr);
        const parsedOver = parseId(overIdStr);

        // 1. Live reordering Categories
        if (parsedActive.type === 'category' && parsedOver.type === 'category') {
            const oldIndex = categories.indexOf(parsedActive.id);
            const newIndex = categories.indexOf(parsedOver.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                setCategories(arrayMove(categories, oldIndex, newIndex));
            }
            return;
        }

        // 2. Live reordering Subcategories
        if (parsedActive.type === 'subcategory' && parsedOver.type === 'subcategory') {
            const activeData = active.data.current;
            const overData = over.data.current;

            if (activeData?.category === overData?.category && activeData && overData) {
                const cat = activeData.category;
                const currentSubs = subcategories[cat] || [];
                const oldIndex = currentSubs.indexOf(activeData.subcategory);
                const newIndex = currentSubs.indexOf(overData.subcategory);
                if (oldIndex !== -1 && newIndex !== -1) {
                    setSubcategories({
                        ...subcategories,
                        [cat]: arrayMove(currentSubs, oldIndex, newIndex)
                    });
                }
            }
            return;
        }

        // 3. Live reordering Items
        if (parsedActive.type === 'item') {
            const activeItem = items.find(i => i.id === parsedActive.id);
            if (!activeItem) return;

            let targetCategory = activeItem.category;
            let targetSubcategory = activeItem.subcategory || null;

            if (parsedOver.type === 'item') {
                const overItem = items.find(i => i.id === parsedOver.id);
                if (overItem) {
                    targetCategory = overItem.category;
                    targetSubcategory = overItem.subcategory || null;
                }
            } else if (parsedOver.type === 'subcategory') {
                const overData = over.data.current;
                if (overData) {
                    targetCategory = overData.category;
                    targetSubcategory = overData.subcategory;
                }
            } else if (parsedOver.type === 'category') {
                targetCategory = parsedOver.id;
                targetSubcategory = null;
            }

            if (targetCategory !== activeItem.category) return;

            // Update item position/subcategory live
            if ((activeItem.subcategory || null) !== targetSubcategory) {
                setItems(prev => prev.map(i => i.id === parsedActive.id ? { ...i, subcategory: targetSubcategory || undefined } : i));
            }

            // Simple index swap for items in the same container
            const currentItems = items.filter(i => i.category === targetCategory && (i.subcategory || null) === targetSubcategory);
            const oldIndex = currentItems.findIndex(i => i.id === parsedActive.id);
            let newIndex = currentItems.findIndex(i => i.id === parsedOver.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const moved = arrayMove(currentItems, oldIndex, newIndex);
                // We need to update the orders of ALL items to match the new arrayMove result
                setItems(prev => {
                    const newItems = [...prev];
                    moved.forEach((item, idx) => {
                        const globalIdx = newItems.findIndex(i => i.id === item.id);
                        if (globalIdx !== -1) newItems[globalIdx] = { ...newItems[globalIdx], order: idx };
                    });
                    return newItems.sort((a, b) => (a.order || 0) - (b.order || 0));
                });
            }
        }
    };

    const handleDragEnd = () => {
        // Final sync if needed
    };

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
    };

    const toggleSubcategory = (fullId: string) => {
        setOpenSubcategories(prev => prev.includes(fullId) ? prev.filter(c => c !== fullId) : [...prev, fullId]);
    };

    const handleCategoryRename = (oldName: string, newName: string) => {
        if (!restaurantId || oldName === newName || !newName.trim()) return;
        setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: newName } : i));
        setCategories(prev => prev.map(c => c === oldName ? newName : c));
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
            setSubcategories({ ...subcategories, [category]: [...currentSubs, newSubcategoryName.trim()] });
        }
        setNewSubcategoryName('');
        setAddingSubcategoryTo(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const restaurantRef = doc(db, 'restaurants', restaurantId);
            batch.set(restaurantRef, { categoryOrder: categories, subcategoryOrder: subcategories }, { merge: true });
            items.forEach((item) => {
                if (!item.id) return;
                batch.update(doc(db, 'menu_items', item.id), {
                    category: item.category,
                    subcategory: item.subcategory || null,
                    order: item.order || 0
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



    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col bg-white sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Menu Structure</DialogTitle>
                    <DialogDescription>Rearrange categories, subcategories, and items.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={categories.map(c => getId('category', c))} strategy={verticalListSortingStrategy}>
                            {categories.map((category) => {
                                const categoryItems = items.filter(i => i.category === category);
                                const categorySubs = subcategories[category] || [];
                                const rootItems = categoryItems.filter(i => !i.subcategory);

                                return (
                                    <SortableCategoryRow
                                        key={category}
                                        category={category}
                                        items={categoryItems}
                                        isOpen={openCategories.includes(category)}
                                        onToggle={() => toggleCategory(category)}
                                        onRename={handleCategoryRename}
                                        rootItems={rootItems}
                                        categorySubs={categorySubs}
                                        openSubcategories={openSubcategories}
                                        toggleSubcategory={toggleSubcategory}
                                        addingSubcategoryTo={addingSubcategoryTo}
                                        setAddingSubcategoryTo={setAddingSubcategoryTo}
                                        newSubcategoryName={newSubcategoryName}
                                        setNewSubcategoryName={setNewSubcategoryName}
                                        handleAddSubcategory={handleAddSubcategory}
                                    />
                                );
                            })}
                        </SortableContext>
                    </DndContext>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <><span className="animate-spin mr-2">⏳</span> Saving...</> : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
