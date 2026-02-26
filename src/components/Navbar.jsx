import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useStore } from '../store/useStore';

const Navbar = () => {
    const { user, setUser } = useStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate('/');
    };

    return (
        <nav className="navbar container-fluid">
            <Link to="/" className="brand" style={{ gap: '10px' }}>
                <div style={{ backgroundColor: '#f59e0b', padding: '0.2rem', borderRadius: '4px', display: 'flex' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                </div>
                Digital Freedom Hub
            </Link>

            <div style={{ flex: 1 }}></div>

            <div className="nav-links">
                {user ? (
                    <>
                        <Link to="/courses" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Classroom</Link>
                        {user.role === 'admin' && (
                            <Link to="/admin" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Admin</Link>
                        )}
                        <button className="btn-ghost" onClick={handleLogout} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#d1d5db', overflow: 'hidden' }}>
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="profile" style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <svg viewBox="0 0 24 24" fill="white" style={{ width: '100%', height: '100%' }}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                            )}
                        </div>
                    </>
                ) : (
                    <Link to="/auth" className="btn-primary">Login</Link>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
