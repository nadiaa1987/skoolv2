import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, getDoc, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import CourseEditor from '../components/CourseEditor';

const DashboardAdmin = () => {
    const [activeTab, setActiveTab] = useState('stats');
    const [users, setUsers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [accessLevel, setAccessLevel] = useState('Open');
    const [coverImage, setCoverImage] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [price, setPrice] = useState(99);
    const [published, setPublished] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        // Users
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(d => d.data()));

        // Payments
        const paymentsSnap = await getDocs(collection(db, 'payments'));
        setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Courses
        const coursesSnap = await getDocs(collection(db, 'courses'));
        setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const calculateStats = () => {
        const totalUsers = users.length;
        const activeMembers = users.filter(u => u.subscription_status === 'active').length;
        const pendingPayments = payments.filter(p => p.status === 'pending').length;
        const approvedPayments = payments.filter(p => p.status === 'approved');
        const totalRevenue = approvedPayments.reduce((acc, p) => acc + p.amount, 0);

        const thisMonth = new Date().getMonth();
        const monthlyRevenue = approvedPayments
            .filter(p => new Date(p.approved_at).getMonth() === thisMonth)
            .reduce((acc, p) => acc + p.amount, 0);

        return { totalUsers, activeMembers, pendingPayments, totalRevenue, monthlyRevenue };
    };

    const handleApprovePayment = async (payment) => {
        const approvedAt = new Date().toISOString();

        // 1. Update payment status
        await updateDoc(doc(db, 'payments', payment.id), {
            status: 'approved',
            approved_at: approvedAt
        });

        // 2. Unlock course for user if applicable
        if (payment.course_id && payment.course_id !== 'platform_subscription') {
            const userRef = doc(db, 'users', payment.user_id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const unlocked = userSnap.data().unlocked_courses || [];
                if (!unlocked.includes(payment.course_id)) {
                    await updateDoc(userRef, {
                        unlocked_courses: [...unlocked, payment.course_id]
                    });
                }
            }
        }

        // 3. Keep global active status for general platform access
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        await updateDoc(doc(db, 'users', payment.user_id), {
            subscription_status: 'active',
            expiry_date: expiryDate.toISOString()
        });

        fetchData();
    };

    const handleRejectPayment = async (payment) => {
        await updateDoc(doc(db, 'payments', payment.id), {
            status: 'rejected'
        });
        await updateDoc(doc(db, 'users', payment.user_id), {
            subscription_status: 'rejected'
        });
        fetchData();
    };

    const handleToggleBlock = async (user) => {
        await updateDoc(doc(db, 'users', user.uid), {
            blocked: !user.blocked
        });
        fetchData();
    };

    const handleStopSubscription = async (user) => {
        await updateDoc(doc(db, 'users', user.uid), {
            subscription_status: 'none',
            expiry_date: null
        });
        fetchData();
    };

    const handleDeleteCourse = async (courseId) => {
        await deleteDoc(doc(db, 'courses', courseId));
        fetchData();
    };

    const handleToggleCourseActive = async (course) => {
        await updateDoc(doc(db, 'courses', course.id), {
            is_active: !course.is_active
        });
        fetchData();
    };

    const handleAddCourse = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            const newCourse = {
                title,
                description,
                price: Number(price),
                cover_image: coverImage || 'https://via.placeholder.com/1460x752?text=Cover+Image',
                video_url: videoUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                is_active: published,
                access_level: accessLevel,
                created_at: new Date().toISOString()
            };

            const docRef = doc(collection(db, 'courses'));
            await setDoc(docRef, { id: docRef.id, ...newCourse });

            setShowModal(false);
            setTitle(''); setDescription(''); setCoverImage(''); setVideoUrl(''); setPrice(99); setAccessLevel('Open'); setPublished(true);

            fetchData();
        } catch (error) {
            console.error("Error adding course", error);
        } finally {
            setSubmitting(false);
        }
    };

    const stats = calculateStats();

    return (
        <div style={{ backgroundColor: '#f7f8f9', minHeight: 'calc(100vh - 60px)', margin: '-2rem -1rem', padding: '2rem 1rem' }}>
            <div className="container">
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Admin Dashboard
                </h2>

                <div className="tab-nav" style={{ marginBottom: '2rem', padding: 0, backgroundColor: 'transparent', borderBottom: '2px solid #e5e7eb' }}>
                    <div className={`tab-nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Stats</div>
                    <div className={`tab-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</div>
                    <div className={`tab-nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</div>
                    <div className={`tab-nav-item ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>Courses Setup</div>
                </div>

                {activeTab === 'stats' && (
                    <div className="grid grid-cols-3 gap-2">
                        <div className="card text-center" style={{ borderRadius: '12px', padding: '2rem 1rem' }}>
                            <h3 className="text-muted" style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.5rem' }}>Total Users</h3>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.totalUsers}</h2>
                        </div>
                        <div className="card text-center" style={{ borderRadius: '12px', padding: '2rem 1rem' }}>
                            <h3 className="text-muted" style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.5rem' }}>Active Members</h3>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.activeMembers}</h2>
                        </div>
                        <div className="card text-center" style={{ borderRadius: '12px', padding: '2rem 1rem' }}>
                            <h3 className="text-muted" style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.5rem' }}>Pending Payments</h3>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: stats.pendingPayments > 0 ? 'var(--warning-color)' : 'inherit' }}>{stats.pendingPayments}</h2>
                        </div>
                        <div className="card text-center" style={{ borderRadius: '12px', padding: '2rem 1rem' }}>
                            <h3 className="text-muted" style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.5rem' }}>Monthly Revenue</h3>
                            <h2 className="text-success" style={{ fontSize: '2.5rem', fontWeight: 800 }}>${stats.monthlyRevenue}</h2>
                        </div>
                        <div className="card text-center" style={{ borderRadius: '12px', padding: '2rem 1rem' }}>
                            <h3 className="text-muted" style={{ fontWeight: 500, fontSize: '1rem', marginBottom: '0.5rem' }}>Total Revenue</h3>
                            <h2 className="text-success" style={{ fontSize: '2.5rem', fontWeight: 800 }}>${stats.totalRevenue}</h2>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="card table-wrapper" style={{ borderRadius: '12px' }}>
                        <h3 style={{ marginBottom: '1rem' }}>User Management</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Blocked</th>
                                    <th>Expiry Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uid}>
                                        <td>{u.email}</td>
                                        <td><span className="badge none">{u.role}</span></td>
                                        <td><span className={`badge ${u.subscription_status}`}>{u.subscription_status}</span></td>
                                        <td>{u.blocked ? <span className="text-danger" style={{ fontWeight: 600 }}>Yes</span> : 'No'}</td>
                                        <td>{u.expiry_date ? new Date(u.expiry_date).toLocaleDateString() : 'N/A'}</td>
                                        <td className="flex gap-1" style={{ alignItems: 'center' }}>
                                            <button className="btn-outline" onClick={() => handleToggleBlock(u)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                                                {u.blocked ? 'Unblock' : 'Block'}
                                            </button>
                                            <button className="btn-outline" onClick={() => handleStopSubscription(u)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Stop Sub</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="card table-wrapper" style={{ borderRadius: '12px' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Payments Management</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Course</th>
                                    <th>Amount</th>
                                    <th>Screenshot</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{p.user_email || 'No email'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.user_id.substring(0, 8)}...</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{p.course_title || 'General access'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {p.course_id?.substring(0, 8)}...</div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>${p.amount}</td>
                                        <td><a href={p.screenshot_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            View
                                        </a></td>
                                        <td>
                                            <div className={`badge ${p.status}`} style={{ textTransform: 'capitalize' }}>{p.status}</div>
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                {p.status === 'pending' && (
                                                    <>
                                                        <button className="btn-success" onClick={() => handleApprovePayment(p)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Approve</button>
                                                        <button className="btn-danger" onClick={() => handleRejectPayment(p)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Reject</button>
                                                    </>
                                                )}
                                                {p.status === 'approved' && (
                                                    <span className="text-success" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        Processed
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'courses' && (
                    selectedCourse ? (
                        <CourseEditor course={selectedCourse} onBack={() => setSelectedCourse(null)} />
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="course-add-card" onClick={() => setShowModal(true)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '0.5rem' }}>
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                New course
                            </div>

                            {courses.map(course => (
                                <div key={course.id} className="card course-card mt-0" style={{ padding: 0, position: 'relative' }} onClick={() => setSelectedCourse(course)}>
                                    <img src={course.cover_image} alt={course.title} />
                                    <div className="course-card-content">
                                        <h3 className="mb-1" style={{ fontSize: '1.1rem' }}>{course.title}</h3>
                                        <p className="text-muted" style={{ fontSize: '0.9rem', flexGrow: 1 }}>
                                            {course.description.substring(0, 70)}...
                                        </p>
                                        <div className="flex justify-between items-center mt-1" style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                                            <div className="flex gap-1">
                                                <button className="btn-outline" onClick={(e) => { e.stopPropagation(); handleToggleCourseActive(course); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                                    {course.is_active ? 'Disable' : 'Enable'}
                                                </button>
                                                <button className="btn-outline" onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger-color)', borderColor: '#fecaca' }}>
                                                    Delete
                                                </button>
                                            </div>
                                            {!course.is_active && <span className="badge none" style={{ fontSize: '0.7rem' }}>Draft</span>}
                                            {course.is_active && <span className="badge active" style={{ fontSize: '0.7rem' }}>Active</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {showModal && activeTab === 'courses' && (
                    <div className="overlay">
                        <div className="modal" style={{ padding: 0 }}>
                            <div className="modal-header">
                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Add course</h3>
                                <button className="btn-ghost" style={{ padding: 0, color: 'var(--primary-color)', fontSize: '0.85rem' }}>
                                    Import with key
                                </button>
                            </div>

                            <div className="modal-body flex-col gap-1">
                                <div>
                                    <input
                                        type="text"
                                        placeholder="Course name"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        maxLength={50}
                                        style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}
                                    />
                                    <div style={{ fontSize: '0.75rem', textAlign: 'right', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderTop: 'none', padding: '0.25rem 0.5rem', borderBottomLeftRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)' }}>
                                        {title.length} / 50
                                    </div>
                                </div>

                                <div className="mt-1">
                                    <textarea
                                        placeholder="Course description"
                                        rows="3"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        maxLength={500}
                                        style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' }}
                                    />
                                    <div style={{ fontSize: '0.75rem', textAlign: 'right', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderTop: 'none', padding: '0.25rem 0.5rem', borderBottomLeftRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)' }}>
                                        {description.length} / 500
                                    </div>
                                </div>

                                <div className="access-options mt-1">
                                    {[
                                        { id: 'Open', title: 'Open', desc: 'All members can access.' },
                                        { id: 'Level unlock', title: 'Level unlock', desc: 'Members unlock at a specific level.' },
                                        { id: 'Buy now', title: 'Buy now', desc: 'Members pay a 1-time price to unlock.' },
                                        { id: 'Time unlock', title: 'Time unlock', desc: 'Members unlock after x days.' },
                                        { id: 'Private', title: 'Private', desc: 'Members on a tier or specific members.' },
                                    ].map((opt) => (
                                        <div
                                            key={opt.id}
                                            className={`access-option ${accessLevel === opt.id ? 'selected' : ''}`}
                                            onClick={() => setAccessLevel(opt.id)}
                                        >
                                            <input
                                                type="radio"
                                                className="access-radio"
                                                name="access"
                                                checked={accessLevel === opt.id}
                                                readOnly
                                            />
                                            <div className="access-option-title">{opt.title}</div>
                                            <div className="access-option-desc">{opt.desc}</div>
                                        </div>
                                    ))}
                                </div>

                                {accessLevel === 'Buy now' && (
                                    <div className="mb-1">
                                        <input type="number" placeholder="Price ($)" value={price} onChange={e => setPrice(e.target.value)} />
                                    </div>
                                )}

                                <div className="flex gap-2 items-center mt-1">
                                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', height: '140px', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                                        {coverImage ? (
                                            <img src={coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ color: 'var(--primary-color)', fontWeight: 500, cursor: 'pointer' }}>Upload</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Cover</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>1460 x 752 px</p>
                                        <input
                                            type="text"
                                            placeholder="Or Image URL..."
                                            value={coverImage}
                                            onChange={e => setCoverImage(e.target.value)}
                                            style={{ marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Video Embed URL..."
                                            value={videoUrl}
                                            onChange={e => setVideoUrl(e.target.value)}
                                            style={{ marginTop: '0.25rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <div className="flex items-center gap-1">
                                    <span style={{ fontWeight: 600, color: published ? 'var(--success-color)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {published ? 'Published' : 'Draft'}
                                    </span>
                                    <label className="switch">
                                        <input type="checkbox" checked={published} onChange={() => setPublished(!published)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button className="btn-ghost" onClick={() => setShowModal(false)} style={{ fontWeight: 600 }}>CANCEL</button>
                                    <button
                                        className="btn-primary"
                                        style={{ backgroundColor: !title ? '#e5e7eb' : 'var(--text-main)', color: !title ? '#9ca3af' : 'white', cursor: !title ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                                        onClick={handleAddCourse}
                                        disabled={!title || submitting}
                                    >
                                        {submitting ? 'ADDING...' : 'ADD'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardAdmin;
