// Script to add sample drinks to the menu
// Run this with: node --loader ts-node/esm add-drinks.ts
// Or add to package.json scripts and run with: npm run add-drinks

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Firebase configuration (update with your credentials)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const drinks = [
    {
        name: "Coca Cola",
        description: "Classic refreshing cola drink",
        price: 3.50,
        category: "Drinks",
        isAvailable: true,
        restaurantId: "YOUR_RESTAURANT_ID", // Update this
        createdAt: new Date()
    },
    {
        name: "Fresh Orange Juice",
        description: "Freshly squeezed orange juice",
        price: 5.00,
        category: "Drinks",
        isAvailable: true,
        restaurantId: "YOUR_RESTAURANT_ID", // Update this
        createdAt: new Date()
    },
    {
        name: "Iced Coffee",
        description: "Cold brew coffee served over ice",
        price: 4.50,
        category: "Drinks",
        isAvailable: true,
        restaurantId: "YOUR_RESTAURANT_ID", // Update this
        createdAt: new Date()
    },
    {
        name: "Mojito",
        description: "Refreshing mint and lime cocktail",
        price: 8.00,
        category: "Drinks",
        isAvailable: true,
        restaurantId: "YOUR_RESTAURANT_ID", // Update this
        createdAt: new Date()
    },
    {
        name: "Sparkling Water",
        description: "Chilled sparkling mineral water",
        price: 3.00,
        category: "Drinks",
        isAvailable: true,
        restaurantId: "YOUR_RESTAURANT_ID", // Update this
        createdAt: new Date()
    }
];

async function addDrinks() {
    try {
        for (const drink of drinks) {
            const docRef = await addDoc(collection(db, 'menuItems'), drink);
            console.log(`Added ${drink.name} with ID: ${docRef.id}`);
        }
        console.log('All drinks added successfully!');
    } catch (error) {
        console.error('Error adding drinks:', error);
    }
}

addDrinks();
