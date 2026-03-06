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

    const [expandedFolders, setExpandedFolders] = useState({});

    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
    };

    // Organize items into hierarchy
    const organizeItems = (flatItems) => {
        const itemMap = {};
        flatItems.forEach(item => {
            itemMap[item.id] = { ...item, children: [] };
        });
        const rootItems = [];
        flatItems.forEach(item => {
            if (item.parentId && itemMap[item.parentId]) {
                itemMap[item.parentId].children.push(itemMap[item.id]);
            } else {
                rootItems.push(itemMap[item.id]);
            }
        });
        return rootItems;
    };

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

    const normalizedVideo = selectedItem ? normalizeVideoUrl(selectedItem.video_url) : '';

    const hierItems = organizeItems(items);

    const renderSidebarItem = (item, depth = 0, indexStr = '') => {
        const isExpanded = !!expandedFolders[item.id];
        const isSelected = selectedItem?.id === item.id;

        return (
            <React.Fragment key={item.id}>
                <div
                    onClick={() => {
                        if (item.type === 'folder') {
                            toggleFolder(item.id);
                        } else {
                            setSelectedItem(item);
                        }
                    }}
                    style={{
                        padding: '0.85rem 1rem',
                        paddingLeft: `${depth * 1.5 + 1}rem`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '0.15rem',
                        backgroundColor: isSelected ? '#fef3c7' : 'transparent',
                        color: isSelected ? '#92400e' : (item.type === 'folder' ? 'var(--text-main)' : '#64748b'),
                        fontWeight: item.type === 'folder' ? '700' : '500',
                        fontSize: depth > 0 ? '0.85rem' : '0.95rem',
                        border: 'none',
                        transition: 'all 0.2s'
                    }}
                    className="sidebar-item-hover"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        {item.type === 'folder' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
                                <path d="M6 9l6 6 6-6"></path>
                            </svg>
                        ) : (
                            <div style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isSelected ? '#92400e' : '#cbd5e1' }}></div>
                            </div>
                        )}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {indexStr && <span style={{ marginRight: '6px', opacity: 0.8 }}>{indexStr}</span>}
                            {item.title}
                        </span>
                    </div>

                    {item.type === 'page' && isSelected && (
                        <div style={{ color: '#10b981', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
                        </div>
                    )}
                </div>
                {item.type === 'folder' && isExpanded && item.children && (
                    <div className="folder-children">
                        {item.children.map((child, idx) => renderSidebarItem(child, depth + 1, `${indexStr}${idx + 1}.`))}
                    </div>
                )}
            </React.Fragment>
        );
    };

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
                            {hierItems.map((item, idx) => renderSidebarItem(item, 0, `${idx + 1}.`))}
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
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '3rem 2rem', border: 'none', background: 'white' }}>
                            <h2 style={{ marginBottom: '2.5rem', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>Curriculum</h2>
                            <div className="curriculum-list">
                                {hierItems.map((item, index) => (
                                    <div key={item.id} style={{ marginBottom: '2.5rem' }}>
                                        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
                                            {index + 1}. {item.title}
                                        </h3>
                                        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                                            {item.children?.map(child => (
                                                <li
                                                    key={child.id}
                                                    onClick={() => setSelectedItem(child)}
                                                    style={{
                                                        marginBottom: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        fontSize: '1rem',
                                                        color: '#475569',
                                                        paddingLeft: '1rem'
                                                    }}
                                                    className="curriculum-item"
                                                >
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1', flexShrink: 0 }}></span>
                                                    {child.title}
                                                </li>
                                            ))}
                                        </ul>
                                        <hr style={{ border: 'none', borderBottom: '1px solid #f1f5f9', marginTop: '2rem' }} />
                                    </div>
                                ))}
                                {hierItems.length === 0 && (
                                    <p className="text-muted text-center">No content has been added to this course yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    <style>{`
                        .curriculum-item:hover {
                            color: var(--primary-color) !important;
                        }
                        .curriculum-item:hover span {
                            backgroundColor: var(--primary-color) !important;
                        }
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
            </div>
        </div>
    );
};

export default CourseDetails;
