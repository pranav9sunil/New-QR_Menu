import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { restaurantId } = useAuth();

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) {
            setError('Restaurant ID not found');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            // Check if user already exists
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                setError('A user with this email already exists');
                setLoading(false);
                return;
            }

            // Note: In a real implementation, you would use Firebase Cloud Functions
            // to create the user with Firebase Auth and send an email invitation.
            // For now, we'll just store the invitation in Firestore.

            await addDoc(collection(db, 'user_invitations'), {
                name,
                email,
                restaurantId,
                role: 'employee',
                defaultPassword: 'password',
                status: 'pending',
                createdAt: new Date(),
            });

            setSuccess('Invitation sent successfully! Default password: "password"');
            setName('');
            setEmail('');

            setTimeout(() => {
                setSuccess('');
                onOpenChange(false);
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Invite User
                    </DialogTitle>
                    <DialogDescription>
                        Invite a new employee to access the admin dashboard. They will receive a default password of "password".
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleInvite} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="Enter user's name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input
                            id="invite-email"
                            type="email"
                            placeholder="Enter user's email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                            {success}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Invitation'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
