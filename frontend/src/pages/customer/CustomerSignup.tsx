import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '@/config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    limit,
    serverTimestamp,
    getDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChefHat } from 'lucide-react';
import type { TableSession } from '@/types';

export default function CustomerSignup() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const tableName = searchParams.get('table');

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'signup' | 'verify'>('signup');
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [tableId, setTableId] = useState<string | null>(null);

    useEffect(() => {
        if (!tableName) {
            navigate('/');
            return;
        }
        checkActiveSession();
    }, [tableName]);

    const checkActiveSession = async () => {
        if (!tableName) return;

        try {
            // Find table first
            const tablesRef = collection(db, 'tables');
            const qTable = query(tablesRef, where('name', '==', tableName), limit(1));
            const tableSnap = await getDocs(qTable);

            if (tableSnap.empty) {
                setError('Invalid table');
                return;
            }

            const tableData = tableSnap.docs[0].data();
            const tId = tableSnap.docs[0].id;
            const rId = tableData.restaurantId;

            setTableId(tId);
            setRestaurantId(rId);

            // Check for active session
            const sessionsRef = collection(db, 'sessions');
            const qSession = query(
                sessionsRef,
                where('tableId', '==', tId),
                where('status', '==', 'active'),
                limit(1)
            );
            const sessionSnap = await getDocs(qSession);

            if (!sessionSnap.empty) {
                setSessionId(sessionSnap.docs[0].id);
            }
        } catch (err) {
            console.error('Error checking session:', err);
            setError('Failed to load session');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !tableId || !restaurantId) return;

        setLoading(true);
        setError('');

        try {
            let currentSessionId = sessionId;

            if (!currentSessionId) {
                // Create new session
                const code = Math.floor(Math.random() * 90 + 10).toString(); // 2 digit code
                const sessionData = {
                    restaurantId,
                    tableId,
                    tableName,
                    code,
                    status: 'active',
                    createdAt: serverTimestamp(),
                    totalAmount: 0,
                };
                const docRef = await addDoc(collection(db, 'sessions'), sessionData);
                currentSessionId = docRef.id;
                setSessionId(currentSessionId);
            }

            // Add customer to session subcollection
            await addDoc(collection(db, `sessions/${currentSessionId}/customers`), {
                name,
                phone,
                joinedAt: serverTimestamp(),
            });

            // Store customer info in local storage for session persistence
            localStorage.setItem('customerName', name);
            localStorage.setItem('customerPhone', phone);
            localStorage.setItem('sessionId', currentSessionId);

            setStep('verify');
        } catch (err) {
            console.error('Error signing up:', err);
            setError('Failed to sign up. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sessionId || !verificationCode) return;

        setLoading(true);
        setError('');

        try {
            const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
            if (!sessionDoc.exists()) {
                setError('Session expired');
                return;
            }

            const sessionData = sessionDoc.data() as TableSession;
            if (sessionData.code === verificationCode) {
                // Success! Redirect to menu
                navigate(`/order?table=${tableName}`);
            } else {
                setError('Invalid code. Please ask your server for the correct code.');
            }
        } catch (err) {
            console.error('Error verifying:', err);
            setError('Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                        <ChefHat className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <CardTitle>Welcome to {tableName}</CardTitle>
                    <CardDescription>
                        {step === 'signup'
                            ? 'Please enter your details to join the table'
                            : 'Please enter the verification code from your server'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 'signup' ? (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="123-456-7890"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Joining...' : 'Join Table'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Verification Code</Label>
                                <Input
                                    id="code"
                                    placeholder="Enter 2-digit code"
                                    maxLength={2}
                                    className="text-center text-2xl tracking-widest"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <p className="text-sm text-destructive">{error}</p>}
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify & View Menu'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
