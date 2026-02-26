import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDEp7sRXCiuZsUK7l7FiAZlKNc9r-DHs1M",
    authDomain: "skool-6de0b.firebaseapp.com",
    projectId: "skool-6de0b",
    storageBucket: "skool-6de0b.firebasestorage.app",
    messagingSenderId: "7055405832",
    appId: "1:7055405832:web:954058558bba61deff32bd",
    measurementId: "G-MTJLTCSLXJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
