export const PERMISSIONS = {
    VIEW_DASHBOARD: 'layout',
    VIEW_KITCHEN: 'kitchen',
    VIEW_BAR: 'bar',
    VIEW_LIVE_BILLS: 'live-bills',
    VIEW_TPV: 'tpv',
    VIEW_PRINTERS: 'printers',
    VIEW_MENU: 'menu',
    VIEW_ACCOUNTS: 'accounts',
    VIEW_PAST_BILLS: 'bills',
    VIEW_QR_CODES: 'qr-codes',
    VIEW_RESERVATIONS: 'reservations',
    VIEW_TABLE_CODES: 'table-codes',
    VIEW_USERS: 'users', // New permissions for the new page
};

export const PERMISSION_LABELS: Record<string, string> = {
    'layout': 'Table Layout',
    'kitchen': 'Live Kitchen',
    'bar': 'Live Bar',
    'live-bills': 'Live Bills',
    'tpv': 'TPV (Manual Order)',
    'printers': 'Printers',
    'menu': 'Menu Management',
    'accounts': 'Accounts & Analytics',
    'bills': 'Past Bills',
    'qr-codes': 'QR Codes',
    'reservations': 'Reservations',
    'table-codes': 'Table Codes',
    'users': 'Users & Roles',
};
