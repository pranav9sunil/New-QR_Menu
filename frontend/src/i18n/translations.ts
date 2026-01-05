// Static UI translations for the customer menu
export type Language = 'en' | 'es';

export const translations: Record<Language, Record<string, string>> = {
    en: {
        // Header
        'menu.title': 'Menu',
        'menu.ourMenu': 'Our Menu',
        'menu.search': 'Search menu...',
        'menu.allItems': 'All Items',
        'menu.filters': 'Filters',

        // Filters
        'filter.vegetarian': 'Vegetarian',
        'filter.nonVeg': 'Non-Veg',
        'filter.vegan': 'Vegan',
        'filter.glutenFree': 'Gluten Free',
        'filter.chefSpecial': "Chef's Special",
        'filter.bestseller': 'Bestseller',

        // Categories
        'menu.categories': 'Categories',
        'menu.menuCategories': 'Menu Categories',

        // Cart
        'cart.title': 'Your Cart',
        'cart.button': 'Cart',
        'cart.empty': 'Your cart is empty',
        'cart.addItems': 'Add items from the menu to get started',
        'cart.subtotal': 'Subtotal',
        'cart.tax': 'Tax',
        'cart.total': 'Total',
        'cart.placeOrder': 'Place Order',
        'cart.viewCart': 'View Cart',
        'cart.items': 'items',
        'cart.item': 'item',

        // Item details
        'item.add': 'Add',
        'item.addToCart': 'Add to Cart',
        'item.addItemToCart': 'Add Item to Cart',
        'item.customizable': 'Customizable',
        'item.customize': 'Customize',
        'item.notes': 'Special instructions (optional)',
        'item.notesTitle': 'Notes',
        'item.notesPlaceholder': 'Add a note',
        'item.allergens': 'Allergens',
        'item.allergenInfo': 'Allergen Info',
        'item.contains': 'Contains',
        'item.spiceLevel': 'Spice Level',
        'item.required': 'Required',
        'item.optional': 'Optional',
        'item.selectAtLeast': 'Select at least',
        'item.selectUpTo': 'Select up to',

        // Orders
        'order.placed': 'Order Placed!',
        'order.preparing': 'Your order is being prepared',
        'order.history': 'Order History',
        'order.noHistory': 'No orders yet',
        'order.pending': 'Pending',
        'order.ready': 'Ready',
        'order.completed': 'Completed',

        // Bill
        'bill.request': 'Request Bill',
        'bill.download': 'Download Receipt',
        'bill.tip': 'Tip',

        // General
        'general.close': 'Close',
        'general.cancel': 'Cancel',
        'general.confirm': 'Confirm',
        'general.loading': 'Loading...',
        'general.noResults': 'No items found',
        'general.more': 'more',

        // Categories
        'category.selectSubcategory': 'Select a subcategory',
    },
    es: {
        // Header
        'menu.title': 'Menú',
        'menu.ourMenu': 'Nuestro Menú',
        'menu.search': 'Buscar en el menú...',
        'menu.allItems': 'Todos',
        'menu.filters': 'Filtros',

        // Filters
        'filter.vegetarian': 'Vegetariano',
        'filter.nonVeg': 'No Veg',
        'filter.vegan': 'Vegano',
        'filter.glutenFree': 'Sin Gluten',
        'filter.chefSpecial': 'Especial del Chef',
        'filter.bestseller': 'Más Vendido',

        // Categories
        'menu.categories': 'Categorías',
        'menu.menuCategories': 'Categorías del Menú',

        // Cart
        'cart.title': 'Tu Carrito',
        'cart.button': 'Carrito',
        'cart.empty': 'Tu carrito está vacío',
        'cart.addItems': 'Añade artículos del menú para empezar',
        'cart.subtotal': 'Subtotal',
        'cart.tax': 'Impuesto',
        'cart.total': 'Total',
        'cart.placeOrder': 'Hacer Pedido',
        'cart.viewCart': 'Ver Carrito',
        'cart.items': 'artículos',
        'cart.item': 'artículo',

        // Item details
        'item.add': 'Añadir',
        'item.addToCart': 'Añadir al Carrito',
        'item.addItemToCart': 'Añadir al Carrito',
        'item.customizable': 'Personalizable',
        'item.customize': 'Personalizar',
        'item.notes': 'Instrucciones especiales (opcional)',
        'item.notesTitle': 'Notas',
        'item.notesPlaceholder': 'Añadir nota',
        'item.allergens': 'Alérgenos',
        'item.allergenInfo': 'Info Alérgenos',
        'item.contains': 'Contiene',
        'item.spiceLevel': 'Nivel de Picante',
        'item.required': 'Obligatorio',
        'item.optional': 'Opcional',
        'item.selectAtLeast': 'Selecciona al menos',
        'item.selectUpTo': 'Selecciona hasta',

        // Orders
        'order.placed': '¡Pedido Realizado!',
        'order.preparing': 'Tu pedido se está preparando',
        'order.history': 'Historial de Pedidos',
        'order.noHistory': 'Aún no hay pedidos',
        'order.pending': 'Pendiente',
        'order.ready': 'Listo',
        'order.completed': 'Completado',

        // Bill
        'bill.request': 'Pedir Cuenta',
        'bill.download': 'Descargar Recibo',
        'bill.tip': 'Propina',

        // General
        'general.close': 'Cerrar',
        'general.cancel': 'Cancelar',
        'general.confirm': 'Confirmar',
        'general.loading': 'Cargando...',
        'general.noResults': 'No se encontraron artículos',
        'general.more': 'más',

        // Categories
        'category.selectSubcategory': 'Selecciona una subcategoría',
    }
};
