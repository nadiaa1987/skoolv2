import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../store/useStore';

/* ---------------- helpers & video players ---------------- */

const formatTime = (sec) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const getYouTubeId = (url) => {
    if (!url) return '';
    const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
    return m && m[1] ? m[1] : '';
};

const getVimeoId = (url) => {
    if (!url) return '';
    const m = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i);
    return m && m[1] ? m[1] : '';
};

let ytApiPromise = null;
const loadYouTubeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!ytApiPromise) {
        ytApiPromise = new Promise((resolve) => {
            window.onYouTubeIframeAPIReady = () => resolve();
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        });
    }
    return ytApiPromise;
};

let vimeoApiPromise = null;
const loadVimeoApi = () => {
    if (window.Vimeo && window.Vimeo.Player) return Promise.resolve();
    if (!vimeoApiPromise) {
        vimeoApiPromise = new Promise((resolve) => {
            const tag = document.createElement('script');
            tag.src = 'https://player.vimeo.com/api/player.js';
            tag.onload = () => resolve();
            document.head.appendChild(tag);
        });
    }
    return vimeoApiPromise;
};

const IconPlay = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>);
const IconPause = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>);
const IconMuted = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3z" /></svg>);
const IconUnmuted = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M3 9v6h4l5 5V4L7 9H3z" /><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" stroke="#fff" strokeWidth="2" fill="none" /></svg>);
const IconExpand = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>);

const VideoPlayer = ({ url, isDirect, youtubeId, vimeoId, embedSrc, onComplete }) => {
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; });

    if (isDirect) return <DirectVideo url={url} notifyComplete={() => onCompleteRef.current()} />;
    if (youtubeId) return <YouTubeVideo youtubeId={youtubeId} notifyComplete={() => onCompleteRef.current()} />;
    if (vimeoId) return <VimeoVideo vimeoId={vimeoId} notifyComplete={() => onCompleteRef.current()} />;
    return <iframe src={embedSrc} title="Video" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen />;
};

const DirectVideo = ({ url, notifyComplete }) => {
    const wrapRef = useRef(null);
    const videoRef = useRef(null);
    const lastPosRef = useRef(0);
    const notifiedRef = useRef(false);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
        else { v.pause(); setPlaying(false); }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    };

    const toggleFullscreen = () => {
        const el = wrapRef.current;
        if (!el) return;
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else el.requestFullscreen().catch(() => {});
    };

    const completeIfReached = (v) => {
        if (notifiedRef.current) return;
        if (v.duration > 0 && v.currentTime >= v.duration - 0.6) {
            notifiedRef.current = true;
            notifyComplete();
        }
    };

    const handleTimeUpdate = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.currentTime > lastPosRef.current + 1.5) {
            v.currentTime = lastPosRef.current;
            return;
        }
        if (v.currentTime > lastPosRef.current) lastPosRef.current = v.currentTime;
        setCurrent(v.currentTime);
        completeIfReached(v);
    };

    const handleEnded = () => {
        setPlaying(false);
        if (!notifiedRef.current) {
            notifiedRef.current = true;
            notifyComplete();
        }
    };

    const pct = duration ? Math.min(100, (current / duration) * 100) : 0;

    return (
        <div ref={wrapRef} tabIndex={0}
            onKeyDown={(e) => {
                if ([32, 37, 38, 39, 36, 35].includes(e.keyCode)) { e.preventDefault(); e.stopPropagation(); }
            }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <video
                ref={videoRef}
                src={url}
                preload="metadata"
                controls={false}
                disablePictureInPicture
                playsInline
                controlsList="nodownload noplaybackrate"
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={(e) => { const v = e.target; if (v && v.duration && isFinite(v.duration)) setDuration(v.duration); }}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, objectFit: 'contain' }}
            />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '52px', zIndex: 5, cursor: 'default' }} onContextMenu={(e) => e.preventDefault()} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '52px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'rgba(255,255,255,0.25)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#f43f5e', transition: 'width 0.25s linear' }} />
                </div>
                <button onClick={togglePlay} style={{ background: 'transparent', border: 'none', padding: '6px', display: 'flex', cursor: 'pointer' }}>{playing ? <IconPause /> : <IconPlay />}</button>
                <button onClick={toggleMute} style={{ background: 'transparent', border: 'none', padding: '6px', display: 'flex', cursor: 'pointer' }}>{muted ? <IconMuted /> : <IconUnmuted />}</button>
                <span style={{ color: '#fff', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums' }}>{formatTime(current)} / {formatTime(duration)}</span>
                <div style={{ flex: 1 }} />
                <button onClick={toggleFullscreen} style={{ background: 'transparent', border: 'none', padding: '6px', display: 'flex', cursor: 'pointer' }}><IconExpand /></button>
            </div>
        </div>
    );
};

const YouTubeVideo = ({ youtubeId, notifyComplete }) => {
    const elRef = useRef(null);
    const playerRef = useRef(null);
    const watcherRef = useRef(null);
    const lastPosRef = useRef(0);
    const notifiedRef = useRef(false);
    const notifyRef = useRef(notifyComplete);
    useEffect(() => { notifyRef.current = notifyComplete; });

    const stopWatcher = () => { if (watcherRef.current) { clearInterval(watcherRef.current); watcherRef.current = null; } };

    const startWatcher = () => {
        stopWatcher();
        watcherRef.current = setInterval(() => {
            const p = playerRef.current;
            if (!p || typeof p.getCurrentTime !== 'function') return;
            const ct = p.getCurrentTime();
            if (ct > lastPosRef.current + 1.5) {
                p.seekTo(lastPosRef.current, true);
            } else if (ct > lastPosRef.current) {
                lastPosRef.current = ct;
            }
        }, 500);
    };

    useEffect(() => {
        let cancelled = false;
        loadYouTubeApi().then(() => {
            if (cancelled || !elRef.current) return;
            playerRef.current = new window.YT.Player(elRef.current, {
                videoId: youtubeId,
                playerVars: { rel: 0, modestbranding: 1, origin: window.location.origin },
                events: {
                    onReady: () => { lastPosRef.current = 0; },
                    onStateChange: (ev) => {
                        const PLAYING = window.YT.PlayerState.PLAYING;
                        const ENDED = window.YT.PlayerState.ENDED;
                        if (ev.data === PLAYING) { startWatcher(); }
                        else if (ev.data === ENDED) {
                            stopWatcher();
                            if (!notifiedRef.current) { notifiedRef.current = true; notifyRef.current(); }
                        }
                        else if (ev.data === window.YT.PlayerState.PAUSED || ev.data === window.YT.PlayerState.BUFFERING) { stopWatcher(); }
                    }
                }
            });
        }).catch(() => {});
        return () => { cancelled = true; stopWatcher(); try { if (playerRef.current && typeof playerRef.current.destroy === 'function') playerRef.current.destroy(); } catch { /* ignore */ } };
    }, [youtubeId]);

    return <div ref={elRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} />;
};

const VimeoVideo = ({ vimeoId, notifyComplete }) => {
    const elRef = useRef(null);
    const playerRef = useRef(null);
    const lastPosRef = useRef(0);
    const notifiedRef = useRef(false);
    const notifyRef = useRef(notifyComplete);
    useEffect(() => { notifyRef.current = notifyComplete; });

    useEffect(() => {
        let cancelled = false;
        loadVimeoApi().then(() => {
            if (cancelled || !elRef.current) return;
            const player = new window.Vimeo.Player(elRef.current, { id: vimeoId });
            playerRef.current = player;
            player.on('ended', () => {
                if (!notifiedRef.current) { notifiedRef.current = true; notifyRef.current(); }
            });
            player.on('timeupdate', ({ seconds }) => {
                if (seconds > lastPosRef.current + 1.5) {
                    player.setCurrentTime(lastPosRef.current).catch(() => {});
                } else if (seconds > lastPosRef.current) {
                    lastPosRef.current = seconds;
                }
            });
        }).catch(() => {});
        return () => { cancelled = true; try { if (playerRef.current && typeof playerRef.current.unload === 'function') playerRef.current.unload(); } catch { /* ignore */ } };
    }, [vimeoId]);

    return <div ref={elRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} />;
};

/* =========================================================== */

const CourseDetails = () => {
    const { user } = useStore();
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lockNotice, setLockNotice] = useState('');

    const [completedVideos, setCompletedVideos] = useState(() => {
        try {
            const saved = localStorage.getItem(`course_progress_${user?.uid || 'guest'}_${id}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(`course_progress_${user?.uid || 'guest'}_${id}`, JSON.stringify(completedVideos));
        } catch { /* ignore */ }
    }, [completedVideos, user?.uid, id]);

    const markCompleted = (itemId) => {
        setCompletedVideos((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
    };

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

    const hierItems = organizeItems(items);

    // Ordered list of pages in curriculum order + sequential video locking
    const orderedPages = [];
    const walk = (nodes) => {
        nodes.forEach((n) => {
            if (n.type === 'page') orderedPages.push(n);
            if (n.children && n.children.length) walk(n.children);
        });
    };
    walk(hierItems);

    const videoPages = orderedPages.filter((p) => !!p.video_url);

    const isVideoLocked = (itemId) => {
        const idx = videoPages.findIndex((p) => p.id === itemId);
        if (idx <= 0) return false;
        return !videoPages.slice(0, idx).every((p) => completedVideos.includes(p.id));
    };

    const isCompleted = (itemId) => completedVideos.includes(itemId);

    const handleSelectItem = (item) => {
        if (item.type === 'folder') {
            toggleFolder(item.id);
            return;
        }
        if (isVideoLocked(item.id)) {
            setLockNotice('Warning: Watch the previous video to the end to unlock this lesson.');
            setTimeout(() => setLockNotice(''), 3500);
            return;
        }
        setLockNotice('');
        setSelectedItem(item);
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
        const ytRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
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

    const renderSidebarItem = (item, depth = 0, indexStr = '') => {
        const isExpanded = !!expandedFolders[item.id];
        const isSelected = selectedItem?.id === item.id;
        const locked = item.type === 'page' && isVideoLocked(item.id);
        const completed = item.type === 'page' && isCompleted(item.id);

        const IconLock = () => (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        );
        const IconComplete = () => (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>
        );

        return (
            <React.Fragment key={item.id}>
                <div
                    onClick={() => handleSelectItem(item)}
                    style={{
                        padding: '0.85rem 1rem',
                        paddingLeft: `${depth * 1.5 + 1}rem`,
                        borderRadius: '12px',
                        cursor: locked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '0.15rem',
                        backgroundColor: isSelected ? '#fef3c7' : 'transparent',
                        color: isSelected ? '#92400e' : (item.type === 'folder' ? 'var(--text-main)' : (locked ? '#cbd5e1' : '#64748b')),
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
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isSelected ? '#92400e' : (completed ? '#10b981' : '#cbd5e1') }}></div>
                            </div>
                        )}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {indexStr && <span style={{ marginRight: '6px', opacity: 0.8 }}>{indexStr}</span>}
                            {item.title}
                        </span>
                    </div>

                    {item.type === 'page' && (locked || completed || isSelected) && (
                        <div style={{ color: locked ? '#94a3b8' : (completed ? '#10b981' : '#f59e0b'), flexShrink: 0 }}
                            title={locked ? 'Locked - finish the previous video first' : (completed ? 'Completed' : 'In progress')}>
                            {locked ? <IconLock /> : (completed ? <IconComplete /> : <IconComplete />)}
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

    const currentVideoIndex = videoPages.findIndex((p) => p.id === (selectedItem ? selectedItem.id : ''));
    const nextVideo = currentVideoIndex >= 0 ? videoPages[currentVideoIndex + 1] : null;
    const selectedVideoComplete = selectedItem && selectedItem.video_url ? isCompleted(selectedItem.id) : false;

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
                                    {selectedItem.video_url && selectedVideoComplete && (
                                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>✓ Completed</span>
                                    )}
                                    {selectedItem.video_url && !selectedVideoComplete && (
                                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>⏳ Watch until the end</span>
                                    )}
                                </div>
                            </div>

                            {lockNotice && (
                                <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>{lockNotice}</div>
                            )}

                            {selectedItem.video_url && (
                                <div style={{ marginBottom: '2rem' }}>
                                    {isVideoLocked(selectedItem.id) && (
                                        <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            Locked - watch the previous video to the end to unlock this lesson.
                                        </div>
                                    )}

                                    <div
                                        style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', backgroundColor: '#000' }}
                                    >
                                        <VideoPlayer
                                            key={selectedItem.id}
                                            url={selectedItem.video_url}
                                            isDirect={isR2orDirect(selectedItem.video_url)}
                                            youtubeId={getYouTubeId(selectedItem.video_url)}
                                            vimeoId={getVimeoId(selectedItem.video_url)}
                                            embedSrc={normalizeVideoUrl(selectedItem.video_url)}
                                            onComplete={() => markCompleted(selectedItem.id)}
                                        />
                                        {selectedItem.video_url.toLowerCase().endsWith('.avi') && (
                                            <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.7rem', zIndex: 20 }}>
                                                ⚠️ Note: AVI format may not play in some browsers. We recommend using <strong>MP4</strong>.
                                            </div>
                                        )}
                                        {selectedVideoComplete && nextVideo && (
                                            <button className="btn-primary"
                                                onClick={() => { setLockNotice(''); setSelectedItem(nextVideo); }}
                                                style={{ position: 'absolute', right: '12px', top: '12px', zIndex: 25, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                Next Lesson
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                                            </button>
                                        )}
                                    </div>

                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                                        ⏳ Skipping is disabled - you must watch this video to the end to unlock the next lesson.
                                    </p>
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
                                                    onClick={() => handleSelectItem(child)}
                                                    style={{
                                                        marginBottom: '0.85rem',
                                                        cursor: isVideoLocked(child.id) ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        fontSize: '1rem',
                                                        color: isVideoLocked(child.id) ? '#cbd5e1' : '#475569',
                                                        paddingLeft: '1rem'
                                                    }}
                                                    className="curriculum-item"
                                                >
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCompleted(child.id) ? '#10b981' : '#cbd5e1', flexShrink: 0 }}></span>
                                                    {child.title}
                                                    {isVideoLocked(child.id) && (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto', flexShrink: 0, color: '#94a3b8' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    )}
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