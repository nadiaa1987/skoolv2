import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { useStore } from '../store/useStore';

const Auth = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { setUser } = useStore();

    const handleGoogleAuth = async () => {
        setError('');
        setLoading(true);
        try {
            const userCredential = await signInWithPopup(auth, googleProvider);
            const { user } = userCredential;

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                // User already exists (Login)
                const data = docSnap.data();
                setUser({ uid: user.uid, ...data });

                if (data.role === 'admin') navigate('/admin');
                else navigate('/dashboard');
            } else {
                // New User (Register)
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || '',
                    photoURL: user.photoURL || '',
                    role: 'user', // only admin can be set manually in DB
                    subscription_status: 'none',
                    blocked: false,
                    expiry_date: null,
                    created_at: new Date().toISOString()
                };

                await setDoc(docRef, userData);
                setUser(userData);
                navigate('/dashboard');
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center mt-2">
            <div className="card text-center" style={{ width: '100%', maxWidth: '400px', padding: '3rem 2rem' }}>
                <h2 className="mb-1">Authentication</h2>
                <p className="text-muted mb-2">Sign in or create an account to access the platform.</p>

                {error && (
                    <div className="mb-2 text-danger" style={{ backgroundColor: 'rgba(218, 54, 51, 0.1)', padding: '0.75rem', borderRadius: '4px' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleAuth}
                    className="btn-primary"
                    disabled={loading}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontSize: '1.1rem',
                        padding: '0.75rem'
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {loading ? 'Please wait...' : 'Continue with Google'}
                </button>
            </div>
        </div>
    );
};

export default Auth;
