import { useEffect, useState } from 'react';
import { db } from '@/config/firebase';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, MapPin } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { MenuItem } from '@/types';

export default function CustomerLanding() {
    const [restaurantName, setRestaurantName] = useState('Welcome');
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        loadRestaurantInfo();
    }, []);

    const loadRestaurantInfo = async () => {
        try {
            const restaurantsRef = collection(db, 'restaurants');
            const q = query(restaurantsRef, limit(1));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setRestaurantName(data.name || 'Welcome');
            }
        } catch (error) {
            console.error('Error loading restaurant info:', error);
        }
    };

    const generateMenuPDF = async () => {
        setLoading(true);
        try {
            // Fetch menu items
            const menuRef = collection(db, 'menu_items');
            const snapshot = await getDocs(menuRef);

            const items: MenuItem[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as MenuItem);
            });

            // Create PDF
            const pdf = new jsPDF();
            let yPosition = 20;

            // Title
            pdf.setFontSize(20);
            pdf.text(restaurantName, 20, yPosition);
            yPosition += 10;

            pdf.setFontSize(14);
            pdf.text('Menu', 20, yPosition);
            yPosition += 15;

            // Group by category
            const categories = Array.from(new Set(items.map((item) => item.category)));

            categories.forEach((category) => {
                // Check if we need a new page
                if (yPosition > 270) {
                    pdf.addPage();
                    yPosition = 20;
                }

                // Category header
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(category, 20, yPosition);
                yPosition += 10;

                // Items in this category
                const categoryItems = items.filter((item) => item.category === category);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(12);

                categoryItems.forEach((item) => {
                    if (yPosition > 270) {
                        pdf.addPage();
                        yPosition = 20;
                    }

                    // Item name and price
                    pdf.text(`${item.name} `, 25, yPosition);
                    pdf.text(`€${item.price.toFixed(2)} `, 180, yPosition, { align: 'right' });
                    yPosition += 5;

                    // Description
                    pdf.setFontSize(10);
                    pdf.setTextColor(100);
                    const lines = pdf.splitTextToSize(item.description, 160);
                    pdf.text(lines, 25, yPosition);
                    yPosition += lines.length * 5 + 5;
                    pdf.setTextColor(0);
                    pdf.setFontSize(12);
                });

                yPosition += 5;
            });

            // Download PDF
            pdf.save(`${restaurantName.replace(/\s+/g, '-')} -menu.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate menu PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleDineIn = () => {
        // Redirect to order page
        // In a real app, you might want to prompt for a table number if not scanned via QR
        window.location.href = '/signup';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
            {/* Hero Section */}
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <div className="flex justify-center mb-8">
                        <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-lg p-1">
                            <img src="/thali_logo.jpg" alt="Thali Logo" className="w-full h-full rounded-full object-cover" />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                        Thali: Authentic Indian Cuisine
                    </h1>
                    <div className="max-w-3xl mx-auto space-y-4">
                        <p className="text-xl text-gray-700 leading-relaxed">
                            Come and discover the authentic taste of India. Our dishes, made with 100% natural ingredients, will transport you to the essence of traditional Indian cuisine.
                        </p>
                        <p className="text-2xl font-semibold text-primary italic">
                            Swagatam!
                        </p>
                    </div>
                </div>

                {/* Action Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* View Menu Card */}
                    <Card className="hover:shadow-2xl transition-shadow border-2 hover:border-primary">
                        <CardContent className="p-8 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                                <FileText className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold mb-4">View Menu</h2>
                            <p className="text-gray-600 mb-6">
                                Download our complete menu as a PDF to browse our delicious offerings
                            </p>
                            <Button
                                onClick={generateMenuPDF}
                                disabled={loading}
                                size="lg"
                                className="w-full"
                            >
                                {loading ? 'Generating PDF...' : 'Download Menu PDF'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Dine In Card */}
                    <Card className="hover:shadow-2xl transition-shadow border-2 hover:border-primary">
                        <CardContent className="p-8 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                                <MapPin className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold mb-4">Dine In</h2>
                            <p className="text-gray-600 mb-6">
                                Scan the QR code at your table or verify your location to start ordering
                            </p>
                            <Button
                                onClick={handleDineIn}
                                size="lg"
                                variant="default"
                                className="w-full"
                            >
                                Start Dining
                            </Button>
                        </CardContent>
                    </Card>
                </div>


            </div>
        </div>
    );
}
