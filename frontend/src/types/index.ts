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
    qrCodeUrl?: string;
    createdAt: Date;
}

export interface MenuItem {
    id: string;
    restaurantId: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl?: string;
    isAvailable: boolean;
    allergens?: string[];
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
    createdAt: Date;
}

export interface OrderItem {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
}

export interface CartItem extends MenuItem {
    quantity: number;
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
}
