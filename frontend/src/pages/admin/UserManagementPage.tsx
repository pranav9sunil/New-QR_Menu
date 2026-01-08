import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, app } from '@/config/firebase'; // Use 'app' to get config for secondary auth
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Users, Shield, Trash2, Edit2 } from 'lucide-react';
import type { User, Role } from '@/types';
import { PERMISSION_LABELS } from '@/constants/permissions';

export default function UserManagementPage() {
    const { restaurantId, userData } = useAuth();
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);


    // Dialog States
    const [showUserDialog, setShowUserDialog] = useState(false);
    const [showRoleDialog, setShowRoleDialog] = useState(false);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ type: 'user' | 'role', id: string, name: string } | null>(null);

    // Form States
    const [userForm, setUserForm] = useState({ name: '', email: '', password: '', roleId: '' });
    const [roleForm, setRoleForm] = useState<{ id?: string, name: string, permissions: string[] }>({ name: '', permissions: [] });
    const [isEditingRole, setIsEditingRole] = useState(false);

    useEffect(() => {
        if (!restaurantId) return;
        loadData();
    }, [restaurantId, activeTab]);

    const loadData = async () => {
        // setLoading(true);
        try {
            // Load Roles
            const rolesRef = collection(db, 'roles');
            const rolesQuery = query(rolesRef, where('restaurantId', '==', restaurantId));
            const rolesSnapshot = await getDocs(rolesQuery);
            const loadedRoles: Role[] = [];
            rolesSnapshot.forEach((doc) => {
                loadedRoles.push({ id: doc.id, ...doc.data() } as Role);
            });
            setRoles(loadedRoles);

            // Load Users
            const usersRef = collection(db, 'users');
            const usersQuery = query(usersRef, where('restaurantId', '==', restaurantId));
            const usersSnapshot = await getDocs(usersQuery);
            const loadedUsers: User[] = [];
            usersSnapshot.forEach((doc) => {
                loadedUsers.push({ id: doc.id, ...doc.data() } as User);
            });
            setUsers(loadedUsers);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            // setLoading(false); 
        }
    };

    // --- Role Management ---

    const handleSaveRole = async () => {
        if (!restaurantId || !roleForm.name.trim()) return;

        try {
            if (isEditingRole && roleForm.id) {
                // Update
                await updateDoc(doc(db, 'roles', roleForm.id), {
                    name: roleForm.name,
                    permissions: roleForm.permissions
                });
                toast.success('Role updated');
            } else {
                // Create
                await addDoc(collection(db, 'roles'), {
                    restaurantId,
                    name: roleForm.name,
                    permissions: roleForm.permissions,
                    createdAt: serverTimestamp()
                });
                toast.success('Role created');
            }
            setShowRoleDialog(false);
            loadData();
        } catch (error) {
            console.error('Error saving role:', error);
            toast.error('Failed to save role');
        }
    };

    const togglePermission = (permId: string) => {
        setRoleForm(prev => {
            const currentPerms = Array.isArray(prev.permissions) ? prev.permissions : [];
            const hasPerm = currentPerms.includes(permId);
            return {
                ...prev,
                permissions: hasPerm
                    ? currentPerms.filter(p => p !== permId)
                    : [...currentPerms, permId]
            };
        });
    };

    const handleDeleteRole = async () => {
        if (!deleteConfirmDialog || deleteConfirmDialog.type !== 'role') return;
        try {
            // Check if assigned to any user
            const assignedUsers = users.filter(u => u.roleId === deleteConfirmDialog.id);
            if (assignedUsers.length > 0) {
                toast.error(`Cannot delete role. Assigned to ${assignedUsers.length} users.`);
                setDeleteConfirmDialog(null);
                return;
            }

            await deleteDoc(doc(db, 'roles', deleteConfirmDialog.id));
            toast.success('Role deleted');
            loadData();
        } catch (error) {
            console.error('Error deleting role:', error);
            toast.error('Failed to delete role');
        } finally {
            setDeleteConfirmDialog(null);
        }
    };

    // --- User Management ---

    const handleCreateUser = async () => {
        if (!restaurantId || !userForm.email || !userForm.password || !userForm.name || !userForm.roleId) return;

        // Determine permissions for the selected role to double check (optional)
        const selectedRole = roles.find(r => r.id === userForm.roleId);
        if (!selectedRole) {
            toast.error('Invalid Role selected');
            return;
        }

        let secondaryApp: FirebaseApp | null = null;
        try {
            toast.loading('Creating user...');

            // 1. Create User in Firebase Auth using a secondary app instance
            // This prevents signing out the current admin
            const config = app.options;
            secondaryApp = initializeApp(config, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userForm.email, userForm.password);
            const newUid = userCredential.user.uid;

            // 2. Create User Document in Firestore
            await setDoc(doc(db, 'users', newUid), {
                email: userForm.email,
                name: userForm.name,
                role: 'employee', // Generic role type
                roleId: userForm.roleId, // Specific custom role
                restaurantId,
                isActive: true,
                createdAt: serverTimestamp()
            });

            // 3. Sign out secondary auth to be clean
            await secondarySignOut(secondaryAuth);

            toast.dismiss();
            toast.success('User created successfully');
            setShowUserDialog(false);
            setUserForm({ name: '', email: '', password: '', roleId: '' });
            loadData();

        } catch (error: any) {
            console.error('Error creating user:', error);
            toast.dismiss();
            if (error.code === 'auth/email-already-in-use') {
                toast.error('Email already in use');
            } else {
                toast.error('Failed to create user: ' + error.message);
            }
        } finally {
            if (secondaryApp) {
                await deleteApp(secondaryApp);
            }
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteConfirmDialog || deleteConfirmDialog.type !== 'user') return;
        // Note: We cannot delete from Auth without Admin SDK.
        // We will just delete the Firestore doc (or deactivate).
        // For this demo, let's delete the doc. The Auth user will remain but have no permissions/data access.

        try {
            await deleteDoc(doc(db, 'users', deleteConfirmDialog.id));
            toast.success('User deleted (Auth account may remain)');
            loadData();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        } finally {
            setDeleteConfirmDialog(null);
        }
    };


    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">User & Role Management</h1>
                    <p className="text-muted-foreground">Manage staff access and permissions</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList>
                    <TabsTrigger value="users" className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Users
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" /> Roles & Permissions
                    </TabsTrigger>
                </TabsList>

                {/* --- USERS TAB --- */}
                <TabsContent value="users" className="flex-1 mt-4 border rounded-md p-4 bg-white">
                    <div className="mb-4 flex justify-end">
                        <Button onClick={() => setShowUserDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Add User
                        </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => {
                                const role = roles.find(r => r.id === user.roleId);
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                {role?.name || user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-green-600' : ''}>
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.id !== userData?.id && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteConfirmDialog({ type: 'user', id: user.id, name: user.name })}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TabsContent>

                {/* --- ROLES TAB --- */}
                <TabsContent value="roles" className="flex-1 mt-4 border rounded-md p-4 bg-white">
                    <div className="mb-4 flex justify-end">
                        <Button onClick={() => {
                            setRoleForm({ name: '', permissions: [] });
                            setIsEditingRole(false);
                            setShowRoleDialog(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" /> Create Role
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roles.map((role) => (
                            <div key={role.id} className="border rounded-lg p-4 bg-gray-50 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{role.name}</h3>
                                        <p className="text-xs text-muted-foreground">{role.permissions.length} permissions</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                            setRoleForm({ id: role.id, name: role.name, permissions: role.permissions });
                                            setIsEditingRole(true);
                                            setShowRoleDialog(true);
                                        }}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        {!role.isSystem && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => setDeleteConfirmDialog({ type: 'role', id: role.id, name: role.name })}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                                            if (role.permissions.includes(key)) {
                                                return (
                                                    <Badge key={key} variant="secondary" className="text-[10px] bg-white border">
                                                        {label}
                                                    </Badge>
                                                )
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Create/Edit Role Dialog */}
            <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                        <DialogDescription>Define access permissions for this role.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input
                                value={roleForm.name}
                                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                                placeholder="e.g. Kitchen Staff"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            <div className="grid grid-cols-2 gap-3 border rounded-md p-4 max-h-[300px] overflow-y-auto">
                                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                                    <div
                                        key={key}
                                        className="flex items-center space-x-2 p-2 rounded hover:bg-slate-100 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            id={`perm-${key}`}
                                            checked={roleForm.permissions?.includes(key) || false}
                                            onChange={() => togglePermission(key)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-black"
                                        />
                                        <label
                                            htmlFor={`perm-${key}`}
                                            className="text-sm font-medium leading-none cursor-pointer flex-1 py-1 select-none"
                                        >
                                            {label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveRole}>Save Role</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create User Dialog */}
            <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a login for a staff member.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                placeholder="staff@restaurant.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                value={userForm.password}
                                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select
                                value={userForm.roleId}
                                onValueChange={(val) => setUserForm({ ...userForm, roleId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUserDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateUser}>Create User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirmDialog} onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete {deleteConfirmDialog?.type} "{deleteConfirmDialog?.name}"?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmDialog(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={deleteConfirmDialog?.type === 'user' ? handleDeleteUser : handleDeleteRole}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
