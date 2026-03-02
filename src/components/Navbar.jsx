import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useStore } from '../store/useStore';
import { markAsRead, markAllAsRead } from '../utils/notifications';

const Navbar = () => {
    const { user, setUser } = useStore();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifs, setShowNotifs] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', 'in', [user.uid, 'broadcast']),
            orderBy('created_at', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(fetched);
            setUnreadCount(fetched.filter(n => !n.read).length);
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
        navigate('/');
    };

    const handleNotifClick = async (notif) => {
        if (!notif.read) {
            await markAsRead(notif.id);
        }
        if (notif.link) {
            navigate(notif.link);
        }
        setShowNotifs(false);
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
                Web Skool Digital
            </Link>

            <div style={{ flex: 1 }}></div>

            <div className="nav-links">
                {user ? (
                    <>
                        <Link to="/courses" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Classroom</Link>
                        {user.role === 'admin' && (
                            <Link to="/admin" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Admin</Link>
                        )}

                        {/* Notification Bell */}
                        <div style={{ position: 'relative' }}>
                            <button className="btn-ghost" onClick={() => setShowNotifs(!showNotifs)} style={{ padding: '0.5rem', position: 'relative' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                </svg>
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '4px', right: '4px', backgroundColor: 'var(--danger-color)',
                                        color: 'white', borderRadius: '50%', width: '16px', height: '16px',
                                        fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '2px solid white'
                                    }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifs && (
                                <div className="card" style={{
                                    position: 'absolute', right: 0, top: '100%', width: '300px', zIndex: 100,
                                    padding: '0', maxHeight: '400px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0 }}>Notifications</h4>
                                        <button className="btn-ghost" style={{ fontSize: '0.8rem', padding: '0.25rem' }} onClick={() => markAllAsRead(user.uid)}>Clear all</button>
                                    </div>
                                    <div style={{ padding: '0.5rem' }}>
                                        {notifications.length === 0 ? (
                                            <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications</p>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotifClick(n)}
                                                    style={{
                                                        padding: '0.75rem', borderRadius: 'var(--radius)', cursor: 'pointer',
                                                        backgroundColor: n.read ? 'transparent' : 'rgba(37, 99, 235, 0.05)',
                                                        marginBottom: '0.25rem'
                                                    }}
                                                >
                                                    <div style={{ fontWeight: n.read ? 400 : 700, fontSize: '0.9rem' }}>{n.title}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.message}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

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
            {showNotifs && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowNotifs(false)}></div>}
        </nav>
    );
};

export default Navbar;
