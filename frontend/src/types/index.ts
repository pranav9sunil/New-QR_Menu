export interface Restaurant {
    id: string;
    name: string;
    logo?: string;
    taxRate: number;
    currency: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    isActive: boolean;
    layoutConfigured: boolean;
    categoryOrder?: string[];
    subcategoryOrder?: Record<string, string[]>;
    // Translations for categories: { "Appetizers": { es: "Entrantes" } }
    categoryTranslations?: Record<string, { es?: string }>;
    // Translations for subcategories: { "Appetizers:Hot": { es: "Calientes" } }
    subcategoryTranslations?: Record<string, { es?: string }>;
    printers?: PrinterDevice[];
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'employee' | 'owner';
    restaurantId: string;
    isActive: boolean;
    createdAt: Date;
    roleId?: string; // ID of the custom Role document
    customRole?: Role; // Populated role data
}

export interface Role {
    id: string;
    restaurantId: string;
    name: string;
    permissions: string[]; // List of Sidebar item IDs they can see
    createdAt: Date;
    isSystem?: boolean; // If true, cannot be deleted (e.g. Owner)
}

export interface Table {
    id: string;
    restaurantId: string;
    name: string;
    seats: number;
    position: {
        x: number;
        y: number;
    };
    isActive: boolean;
    reservation?: {
        name: string;
        phone: string;
        guests: number;
        time: string;
    };
    qrCodeUrl?: string;
    layoutId?: string;
    createdAt: Date;
}

export interface Layout {
    id: string;
    restaurantId: string;
    name: string;
    createdAt: Date;
}

export interface CustomizationOption {
    name: string;
    price: number;
    isVegetarian?: boolean;
    isVegan?: boolean;
    isGlutenFree?: boolean;
    translations?: {
        es?: { name?: string };
    };
}

export interface CustomizationGroup {
    id: string;
    name: string;
    type: 'single' | 'multiple';
    minSelection?: number;
    maxSelection?: number;
    options: CustomizationOption[];
    translations?: {
        es?: { name?: string };
    };
}

export interface MenuItem {
    id: string;
    restaurantId: string;
    name: string;
    description: string;
    price: number;
    category: string;
    subcategory?: string;
    imageUrl?: string;
    isAvailable: boolean;
    allergens?: string[];
    dietary: ('vegan' | 'vegetarian' | 'gluten-free' | 'non-vegetarian' | 'dairy' | 'gluten')[];
    spiceLevel?: 0 | 1 | 2 | 3;
    isChefSpecial?: boolean;
    isBestseller?: boolean;
    customizationOptions?: CustomizationGroup[];
    order?: number;
    translations?: {
        es?: { name?: string; description?: string };
    };
    createdAt: Date;
}

export interface Order {
    id: string;
    restaurantId: string;
    tableId: string;
    tableName: string;
    sessionId?: string;
    items: OrderItem[];
    status: 'pending' | 'preparing' | 'ready' | 'completed';
    subtotal: number;
    tax: number;
    total: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    manualOrder?: boolean;
    paymentType?: 'full' | 'split';
    paymentMethod?: 'cash' | 'card' | null;
    createdAt: Date;
}

export interface OrderItem {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    selectedCustomizations?: { name: string; price: number }[];
    notes?: string;
    paidQuantity?: number;
}

export interface CartItem extends MenuItem {
    quantity: number;
    selectedCustomizations?: Record<string, CustomizationOption[]>;
    notes?: string;
}

export interface SessionCustomer {
    id?: string;
    name: string;
    phone: string;
    joinedAt: Date;
}

export interface TableSession {
    id: string;
    restaurantId: string;
    tableId: string;
    tableName: string;
    code: string;
    status: 'active' | 'closed' | 'payment_pending';
    createdAt: Date;
    customers?: SessionCustomer[];
    totalAmount?: number;
    tipAmount?: number;
    tipPercentage?: number;
    closedAt?: Date;
}

export interface Reservation {
    id: string;
    restaurantId: string;
    customerName: string;
    phone: string;
    dateTime: Date;
    tableId?: string;
    tableName?: string;
    notes?: string;
    guests?: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    createdAt: Date;
}

export interface PrinterDevice {
    id: string;
    name: string;
    type: 'kitchen' | 'bar' | 'receipt';
    ipAddress: string;
    port: string;
    status: 'online' | 'offline';
}

export interface SessionWithOrders {
    sessionId: string;
    tableName: string;
    tableId: string;
    orders: Order[];
    totalAmount: number;
}
