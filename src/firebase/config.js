import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBOAbhk0DY5-Rb7kA52pr8bntvQPWUphM8",
    authDomain: "skoolit-48a57.firebaseapp.com",
    projectId: "skoolit-48a57",
    storageBucket: "skoolit-48a57.firebasestorage.app",
    messagingSenderId: "357070931068",
    appId: "1:357070931068:web:b8edc066330c2e0672b5f9",
    measurementId: "G-Q0D6P3MYGP"
};

import { getMessaging } from "firebase/messaging";
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
export const storage = getStorage(app);
export const messaging = getMessaging(app);
export const googleProvider = new GoogleAuthProvider();
