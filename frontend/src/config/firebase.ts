import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyAT2acMkrTKsMMaW2aR5aGLTMdYQbje7i8",
    authDomain: "qr-ordering-system-c80d4.firebaseapp.com",
    projectId: "qr-ordering-system-c80d4",
    storageBucket: "qr-ordering-system-c80d4.firebasestorage.app",
    messagingSenderId: "380518528753",
    appId: "1:380518528753:web:4893e0ed933138b5f99b50",
    measurementId: "G-6T9PQMLRY9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
