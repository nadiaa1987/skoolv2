import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../store/useStore';

const CourseDetails = () => {
    const { user } = useStore();
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourse = async () => {
            try {
                const docRef = doc(db, 'courses', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().is_active) {
                    setCourse({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setCourse(null);
                }
            } catch (err) {
                console.error("Error fetching course:", err);
            }
        };
        fetchCourse();

        // Fetch content
        const q = query(collection(db, 'courses', id, 'content'), orderBy('order', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(fetchedItems);

            // Auto-select first page if none selected
            if (!selectedItem && fetchedItems.length > 0) {
                const firstPage = fetchedItems.find(i => i.type === 'page');
                if (firstPage) setSelectedItem(firstPage);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id]);

    if (loading) return <div className="container mt-2 text-center">Loading course...</div>;
    if (!course) return <div className="container mt-2 text-center text-danger">Course not found or inactive.</div>;

    const isAdmin = user?.role === 'admin';
    const isPaid = course.access_level === 'Buy now';
    const isUnlocked = isAdmin || !isPaid || (user?.unlocked_courses || []).includes(course.id);

    if (!isUnlocked) {
        return (
            <div className="container mt-2 text-center">
                <div className="card" style={{ padding: '4rem 2rem' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1.5rem', color: 'var(--danger-color)' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <h2 className="mb-1">This course is locked</h2>
                    <p className="text-muted mb-2">You need to purchase this course to access the content.</p>
                    <button className="btn-primary" onClick={() => navigate(`/payment?courseId=${course.id}`)}>Unlock Now</button>
                    <button className="btn-ghost mt-1" onClick={() => navigate('/courses')}>Back to Classroom</button>
                </div>
            </div>
        );
    }

    const normalizeVideoUrl = (url) => {
        if (!url) return '';
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const ytMatch = url.match(ytRegex);
        if (ytMatch && ytMatch[1]) return `https://www.youtube.com/embed/${ytMatch[1]}`;
        const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch && vimeoMatch[1]) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        return url;
    };

    return (
        <div className="container-fluid" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>

                {/* Sidebar */}
                <div style={{ width: '320px', flexShrink: 0 }}>
                    <button className="btn-outline mb-1 w-full" onClick={() => navigate('/courses')} style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        &larr; Back to Courses
                    </button>

                    <div className="card" style={{ padding: '1rem', position: 'sticky', top: '80px' }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{course.title}</h3>
                        <div style={{ backgroundColor: '#f3f4f6', height: '8px', borderRadius: '4px', marginBottom: '1.5rem', overflow: 'hidden' }}>
                            <div style={{ backgroundColor: 'var(--success-color)', width: '0%', height: '100%', transition: 'width 0.3s' }}></div>
                        </div>

                        <div className="lesson-list">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => item.type === 'page' && setSelectedItem(item)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius)',
                                        cursor: item.type === 'page' ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        marginBottom: '0.25rem',
                                        backgroundColor: selectedItem?.id === item.id ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                                        color: selectedItem?.id === item.id ? 'var(--primary-color)' : 'inherit',
                                        fontWeight: item.type === 'folder' ? '700' : '500',
                                        marginTop: item.type === 'folder' ? '1rem' : '0'
                                    }}
                                >
                                    {item.type === 'folder' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><polyline points="9 11 12 14 22 4"></polyline></svg>
                                    )}
                                    <span style={{ fontSize: '0.9rem' }}>{item.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1 }}>
                    {selectedItem ? (
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{selectedItem.title}</h1>
                                <button className="btn-success">Complete</button>
                            </div>

                            {selectedItem.video_url && (
                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                    <iframe
                                        src={normalizeVideoUrl(selectedItem.video_url)}
                                        title={selectedItem.title}
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                        allowFullScreen
                                    />
                                </div>
                            )}

                            {selectedItem.image_url && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <img src={selectedItem.image_url} alt={selectedItem.title} style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                                </div>
                            )}

                            <div
                                className="content-body"
                                style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: '1.8' }}
                                dangerouslySetInnerHTML={{ __html: selectedItem.body }}
                            />
                        </div>
                    ) : (
                        <div className="card text-center" style={{ padding: '5rem 2rem' }}>
                            <h2 className="text-muted">Select a lesson to begin</h2>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CourseDetails;
