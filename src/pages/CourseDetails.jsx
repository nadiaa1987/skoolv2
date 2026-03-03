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

        // Content protection: Block common inspection shortcuts
        const handleKeyDown = (e) => {
            if (
                e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
                (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Cmd+Opt+I/J/C (Mac)
                (e.ctrlKey && e.keyCode === 85) || // Ctrl+U
                (e.metaKey && e.keyCode === 85) // Cmd+U
            ) {
                e.preventDefault();
                return false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            unsubscribe();
            window.removeEventListener('keydown', handleKeyDown);
        };
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

    const isR2orDirect = (url) => {
        if (!url) return false;
        return url.includes('cloudflarestorage.com') || url.includes('r2.dev') || url.match(/\.(mp4|webm|ogg|mov|avi)$/i);
    };

    const normalizedVideo = normalizeVideoUrl(selectedItem.video_url);

    return (
        <div className="container-fluid mobile-classroom" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <div className="classroom-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%', maxWidth: '1280px' }}>

                {/* Sidebar */}
                <div className="classroom-sidebar" style={{ width: '320px', flexShrink: 0 }}>
                    <button className="btn-outline mb-1 w-full" onClick={() => navigate('/courses')} style={{ textAlign: 'left', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
                        Back to Courses
                    </button>

                    <div className="card" style={{ padding: '0', position: 'sticky', top: '80px', border: 'none', background: 'white' }}>
                        <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', flex: 1 }}>{course.title}</h3>
                            <button className="btn-ghost" style={{ padding: '0', color: 'var(--text-muted)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                        </div>

                        {/* Progress Bar with Percentage */}
                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                            <div style={{ backgroundColor: '#f3f4f6', height: '24px', borderRadius: '12px', overflow: 'hidden', position: 'relative', marginTop: '1rem' }}>
                                <div style={{ backgroundColor: '#10b981', width: '100%', height: '100%', transition: 'width 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>100%</span>
                                </div>
                            </div>
                        </div>

                        <div className="lesson-list" style={{ padding: '0 0.5rem 1rem 0.5rem' }}>
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => item.type === 'page' && setSelectedItem(item)}
                                    style={{
                                        padding: '0.85rem 1rem',
                                        borderRadius: '12px',
                                        cursor: item.type === 'page' ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px',
                                        marginBottom: '0.15rem',
                                        backgroundColor: selectedItem?.id === item.id ? '#fef3c7' : 'transparent',
                                        color: selectedItem?.id === item.id ? '#92400e' : 'var(--text-main)',
                                        fontWeight: item.type === 'folder' ? '700' : '500',
                                        border: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                        {item.type === 'folder' ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                        ) : null}
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                                    </div>

                                    {item.type === 'page' && (
                                        <div style={{ color: '#10b981', flexShrink: 0 }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="classroom-main" style={{ flex: 1, maxWidth: '740px' }}>
                    {selectedItem ? (
                        <div className="card" style={{ padding: '2rem', border: 'none', background: 'white' }}>
                            <div className="classroom-content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h1 style={{ fontSize: '1.45rem', fontWeight: 'bold', margin: 0, color: 'var(--text-main)' }}>{selectedItem.title}</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ color: '#10b981' }}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {selectedItem.video_url && (
                                <div
                                    style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', backgroundColor: '#000' }}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    {/* Invisible Shield - Blocks direct right-click on the video stream */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '60px', zIndex: 5, cursor: 'default' }}></div>

                                    {isR2orDirect(selectedItem.video_url) ? (
                                        <>
                                            <video
                                                src={selectedItem.video_url}
                                                controls
                                                controlsList="nodownload noplaybackrate"
                                                disablePictureInPicture
                                                playsInline
                                                onContextMenu={(e) => e.preventDefault()}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                            />
                                            {selectedItem.video_url.toLowerCase().endsWith('.avi') && (
                                                <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.7rem', zIndex: 10 }}>
                                                    ⚠️ Note: AVI format may not play in some browsers. We recommend using <strong>MP4</strong>.
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <iframe
                                            src={normalizedVideo}
                                            title={selectedItem.title}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                            allowFullScreen
                                        />
                                    )}
                                </div>
                            )}

                            {selectedItem.image_url && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <img src={selectedItem.image_url} alt={selectedItem.title} style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                                </div>
                            )}

                            <div
                                className="content-body"
                                style={{
                                    color: 'var(--text-main)',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.6',
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '2rem',
                                    marginTop: '1rem',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere'
                                }}
                                dangerouslySetInnerHTML={{ __html: selectedItem.body }}
                            />

                            <style>{`
                                .content-body img {
                                    max-width: 100%;
                                    height: auto;
                                    border-radius: 8px;
                                    margin: 1.5rem 0;
                                    display: block;
                                }
                                .content-body p {
                                    margin-bottom: 1rem;
                                }
                                .content-body a {
                                    color: var(--primary-color);
                                    text-decoration: underline;
                                }

                                /* Mobile Responsiveness */
                                @media (max-width: 768px) {
                                    .classroom-layout {
                                        flex-direction: column !important;
                                        padding: 0 1rem;
                                        gap: 1.5rem !important;
                                    }
                                    .classroom-sidebar {
                                        width: 100% !important;
                                        order: 2;
                                    }
                                    .classroom-sidebar .card {
                                        position: static !important;
                                        margin-bottom: 2rem;
                                    }
                                    .classroom-main {
                                        width: 100% !important;
                                        max-width: 100% !important;
                                        order: 1;
                                    }
                                    .classroom-main .card {
                                        padding: 1.25rem !important;
                                    }
                                    .classroom-content-header {
                                        margin-bottom: 1rem !important;
                                    }
                                    .classroom-content-header h1 {
                                        font-size: 1.2rem !important;
                                    }
                                }
                            `}</style>
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
