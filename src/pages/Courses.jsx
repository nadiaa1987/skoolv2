import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../store/useStore';

const Courses = () => {
    const { user } = useStore();
    const isAdmin = user?.role === 'admin';
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('Classroom');

    const fetchCourses = async () => {
        try {
            // Admin sees all courses, User sees active courses
            const q = isAdmin
                ? query(collection(db, 'courses'))
                : query(collection(db, 'courses'), where('is_active', '==', true));
            const snap = await getDocs(q);
            setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Error fetching courses:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'Classroom') {
            fetchCourses();
        }
    }, [isAdmin, activeTab]);

    if (loading && activeTab === 'Classroom') return <div className="container mt-2 text-center text-muted">Loading courses...</div>;

    const renderComingSoon = (tabName) => (
        <div className="container mt-4 text-center">
            <div className="card" style={{ padding: '5rem 2rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🚧</h1>
                <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{tabName} is Coming Soon</h2>
                <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto' }}>
                    We are working hard to bring this feature to your community. Stay tuned for exciting updates!
                </p>
                <button className="btn-primary mt-2" onClick={() => setActiveTab('Classroom')}>Back to Classroom</button>
            </div>
        </div>
    );

    return (
        <div>
            {/* Mock Header Tabs like Skool */}
            <div className="tab-nav">
                <div className="container flex items-center" style={{ gap: '2rem' }}>
                    {['Community', 'Classroom', 'Calendar', 'Members', 'Leaderboards'].map(tab => (
                        <div
                            key={tab}
                            className={`tab-nav-item ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </div>
                    ))}
                </div>
            </div>

            {activeTab !== 'Classroom' ? renderComingSoon(activeTab) : (
                <div className="container mt-1">
                    <div className="grid grid-cols-3 gap-2">
                        {/* Course List */}
                        {courses.map(course => {
                            const isPaid = course.access_level === 'Buy now';
                            const isUnlocked = isAdmin || !isPaid || (user?.unlocked_courses || []).includes(course.id);

                            return (
                                <Link to={isUnlocked ? `/course/${course.id}` : `/payment?courseId=${course.id}`} key={course.id} className="card course-card">
                                    <div style={{ position: 'relative' }}>
                                        <img src={course.cover_image} alt={course.title} />
                                        {!isUnlocked && (
                                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="course-card-content">
                                        <h3 className="mb-1" style={{ fontSize: '1.1rem' }}>{course.title}</h3>

                                        {course.description && (
                                            <p className="text-muted" style={{ fontSize: '0.9rem', flexGrow: 1 }}>
                                                {course.description.substring(0, 80)}...
                                            </p>
                                        )}
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex items-center gap-1">
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280' }}>
                                                    {course.access_level || 'Open'}
                                                </span>
                                                {isPaid && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.15rem 0.4rem',
                                                        borderRadius: '4px',
                                                        backgroundColor: isUnlocked ? '#d1fae5' : '#fee2e2',
                                                        color: isUnlocked ? '#065f46' : '#991b1b',
                                                        fontWeight: 700,
                                                        display: 'inline-block',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {isUnlocked ? 'UNLOCKED' : 'PAID'}
                                                    </span>
                                                )}
                                                {!isPaid && (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '0.15rem 0.4rem',
                                                        borderRadius: '4px',
                                                        backgroundColor: '#e0f2fe',
                                                        color: '#0369a1',
                                                        fontWeight: 700,
                                                        display: 'inline-block',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        FREE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                {isAdmin && !course.is_active && (
                                                    <span className="badge none" style={{ fontSize: '0.7rem' }}>Draft</span>
                                                )}
                                                {!isUnlocked && (
                                                    <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>Unlock Access</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                        {courses.length === 0 && (
                            <p className="text-muted" style={{ gridColumn: 'span 3', textAlign: 'center', marginTop: '2rem' }}>
                                Your classroom is currently empty.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Courses;
