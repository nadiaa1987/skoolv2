import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, getDoc, updateDoc, doc, deleteDoc, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { v4 as uuidv4 } from 'uuid';
import CourseEditor from '../components/CourseEditor';
import { createNotification } from '../utils/notifications';

const DashboardAdmin = () => {
    const [activeTab, setActiveTab] = useState('stats');
    const [users, setUsers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // New Course Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [accessLevel, setAccessLevel] = useState('Open');
    const [coverImage, setCoverImage] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [price, setPrice] = useState(99);
    const [published, setPublished] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [fakeMembers, setFakeMembers] = useState(0);
    const [showDiscount, setShowDiscount] = useState(false);

    // OneSignal Push Notification state
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [pushLink, setPushLink] = useState('');
    const [pushImage, setPushImage] = useState('');
    const [oneSignalAppId, setOneSignalAppId] = useState('');
    const [oneSignalRestKey, setOneSignalRestKey] = useState('');
    const [pushStatus, setPushStatus] = useState('');

    useEffect(() => {
        fetchData();
        // Load saved keys from localStorage if any
        setOneSignalAppId(localStorage.getItem('os_app_id') || '');
        setOneSignalRestKey(localStorage.getItem('os_rest_key') || '');
    }, []);

    const fetchData = async () => {
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(d => d.data()));
        const paymentsSnap = await getDocs(collection(db, 'payments'));
        setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
        await updateDoc(doc(db, 'payments', payment.id), { status: 'approved', approved_at: approvedAt });
        if (payment.course_id && payment.course_id !== 'platform_subscription') {
            const userRef = doc(db, 'users', payment.user_id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const unlocked = userSnap.data().unlocked_courses || [];
                if (!unlocked.includes(payment.course_id)) {
                    await updateDoc(userRef, { unlocked_courses: [...unlocked, payment.course_id] });

                    // Increment real_members_count on the course doc
                    const courseRef = doc(db, 'courses', payment.course_id);
                    const courseSnap = await getDoc(courseRef);
                    if (courseSnap.exists()) {
                        const currentRealCount = courseSnap.data().real_members_count || 0;
                        await updateDoc(courseRef, { real_members_count: currentRealCount + 1 });
                    }
                }
            }
        }
        await createNotification(payment.user_id, {
            title: 'Payment Approved!',
            message: `Your payment for ${payment.course_title || 'the course'} has been approved. Enjoy!`,
            type: 'success',
            link: '/courses'
        });
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        await updateDoc(doc(db, 'users', payment.user_id), {
            subscription_status: 'active',
            expiry_date: expiryDate.toISOString()
        });
        fetchData();
    };

    const handleRejectPayment = async (payment) => {
        await updateDoc(doc(db, 'payments', payment.id), { status: 'rejected' });
        await updateDoc(doc(db, 'users', payment.user_id), { subscription_status: 'rejected' });
        await createNotification(payment.user_id, {
            title: 'Payment Rejected',
            message: 'Your payment was not approved. Please check your details and try again.',
            type: 'error'
        });
        fetchData();
    };

    const handleToggleBlock = async (user) => {
        await updateDoc(doc(db, 'users', user.uid), { blocked: !user.blocked });
        fetchData();
    };

    const handleStopSubscription = async (user) => {
        await updateDoc(doc(db, 'users', user.uid), { subscription_status: 'none', expiry_date: null });
        fetchData();
    };

    const handleDeleteCourse = async (courseId) => {
        if (!window.confirm("Delete course?")) return;
        await deleteDoc(doc(db, 'courses', courseId));
        fetchData();
    };

    const handleToggleCourseActive = async (course) => {
        await updateDoc(doc(db, 'courses', course.id), { is_active: !course.is_active });
        fetchData();
    };

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

    const handleAddCourse = async () => {
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            const normalizedVideo = normalizeVideoUrl(videoUrl);
            const courseData = {
                title,
                description,
                price: Number(price),
                cover_image: coverImage || 'https://via.placeholder.com/1460x752?text=Cover+Image',
                video_url: normalizedVideo || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                is_active: published,
                access_level: accessLevel,
                fake_members_count: Number(fakeMembers),
                show_discount: showDiscount,
                updated_at: new Date().toISOString()
            };

            if (editingCourse) {
                await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
            } else {
                const docRef = doc(collection(db, 'courses'));
                await setDoc(docRef, {
                    id: docRef.id,
                    ...courseData,
                    created_at: new Date().toISOString()
                });

                if (published) {
                    await createNotification('broadcast', {
                        title: 'New Course Available!',
                        message: `Check out our new course: ${title}`,
                        type: 'info',
                        link: '/courses'
                    });
                }
            }

            setShowModal(false);
            setEditingCourse(null);
            setTitle(''); setDescription(''); setCoverImage(''); setVideoUrl(''); setPrice(99); setAccessLevel('Open'); setPublished(true); setFakeMembers(0); setShowDiscount(false);
            fetchData();
        } catch (error) {
            console.error("Error saving course", error);
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (course) => {
        setEditingCourse(course);
        setTitle(course.title || '');
        setDescription(course.description || '');
        setAccessLevel(course.access_level || 'Open');
        setCoverImage(course.cover_image || '');
        setVideoUrl(course.video_url || '');
        setPrice(course.price || 99);
        setFakeMembers(course.fake_members_count || 0);
        setShowDiscount(course.show_discount || false);
        setPublished(course.is_active !== undefined ? course.is_active : true);
        setShowModal(true);
    };

    const handleSendOneSignalPush = async () => {
        if (!pushTitle || !pushBody || !oneSignalAppId || !oneSignalRestKey) {
            setPushStatus('❌ All fields are required including OneSignal Keys.');
            return;
        }

        // Save keys locally for convenience
        localStorage.setItem('os_app_id', oneSignalAppId);
        localStorage.setItem('os_rest_key', oneSignalRestKey);

        setPushStatus('⏳ Sending via OneSignal...');
        try {
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${oneSignalRestKey}`
                },
                body: JSON.stringify({
                    app_id: oneSignalAppId,
                    included_segments: ['Subscribed Users'],
                    contents: { en: pushBody },
                    headings: { en: pushTitle },
                    url: pushLink || undefined,
                    big_picture: pushImage || undefined,
                })
            });

            const result = await response.json();
            if (result.id) {
                setPushStatus(`✅ Success! Notification sent to ${result.recipients || 'all'} subscribers.`);
                setPushTitle(''); setPushBody(''); setPushLink(''); setPushImage('');
            } else {
                setPushStatus('❌ Error: ' + (result.errors?.[0] || 'Check your keys.'));
            }
        } catch (error) {
            console.error("Error sending OneSignal push:", error);
            setPushStatus('❌ Error: ' + error.message);
        }
    };

    const stats = calculateStats();

    return (
        <div style={{ backgroundColor: '#f7f8f9', minHeight: 'calc(100vh - 60px)', margin: '-2rem -1rem', padding: '2rem 1rem' }}>
            <div className="container">
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>Admin Dashboard</h2>

                <div className="tab-nav" style={{ marginBottom: '2rem', padding: 0, backgroundColor: 'transparent', borderBottom: '2px solid #e5e7eb' }}>
                    <div className={`tab-nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Stats</div>
                    <div className={`tab-nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users</div>
                    <div className={`tab-nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</div>
                    <div className={`tab-nav-item ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>Courses Setup</div>
                    <div className={`tab-nav-item ${activeTab === 'push' ? 'active' : ''}`} onClick={() => setActiveTab('push')}>Push Notifications (Method 2)</div>
                </div>

                {activeTab === 'stats' && (
                    <div className="grid grid-cols-3 gap-2">
                        <div className="card text-center">
                            <h3 className="text-muted" style={{ fontSize: '1rem' }}>Total Users</h3>
                            <h2 style={{ fontSize: '2.5rem' }}>{stats.totalUsers}</h2>
                        </div>
                        <div className="card text-center">
                            <h3 className="text-muted" style={{ fontSize: '1rem' }}>Active Members</h3>
                            <h2 style={{ fontSize: '2.5rem' }}>{stats.activeMembers}</h2>
                        </div>
                        <div className="card text-center">
                            <h3 className="text-muted" style={{ fontSize: '1rem' }}>Pending Payments</h3>
                            <h2 style={{ fontSize: '2.5rem', color: stats.pendingPayments > 0 ? 'var(--warning-color)' : 'inherit' }}>{stats.pendingPayments}</h2>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="card table-wrapper">
                        <h3>User Management</h3>
                        <table>
                            <thead>
                                <tr><th>Email</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uid}>
                                        <td>{u.email}</td>
                                        <td><span className={`badge ${u.subscription_status}`}>{u.subscription_status}</span></td>
                                        <td><button className="btn-outline" onClick={() => handleToggleBlock(u)}>{u.blocked ? 'Unblock' : 'Block'}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="card table-wrapper">
                        <div className="flex justify-between items-center mb-1">
                            <h3>Payment Requests</h3>
                            <button className="btn-ghost" onClick={fetchData}>Refresh</button>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Course / Plan</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Receipt</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center text-muted">No payment records found.</td></tr>
                                ) : (
                                    payments.map(p => (
                                        <tr key={p.id}>
                                            <td>{p.user_email}</td>
                                            <td style={{ fontWeight: 600 }}>{p.course_title}</td>
                                            <td style={{ color: 'var(--success-color)', fontWeight: 700 }}>${p.amount}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <a href={p.screenshot_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    View Receipt
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                </a>
                                            </td>
                                            <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                                            <td>
                                                {p.status === 'pending' && (
                                                    <div className="flex gap-1" style={{ gap: '0.5rem' }}>
                                                        <button
                                                            className="btn-primary"
                                                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', backgroundColor: 'var(--success-color)' }}
                                                            onClick={() => handleApprovePayment(p)}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            className="btn-outline"
                                                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                                                            onClick={() => handleRejectPayment(p)}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {p.status !== 'pending' && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Processed on {p.approved_at ? new Date(p.approved_at).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'courses' && (
                    selectedCourse ? (
                        <CourseEditor course={selectedCourse} onBack={() => setSelectedCourse(null)} />
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="course-add-card" onClick={() => setShowModal(true)}>+ New course</div>
                            {courses.map(course => (
                                <div key={course.id} className="card course-card" onClick={() => setSelectedCourse(course)}>
                                    <img src={course.cover_image} alt={course.title} />
                                    <div className="course-card-content">
                                        <h3>{course.title}</h3>
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="flex gap-1">
                                                <button className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); openEditModal(course); }}>Edit</button>
                                                <button className="btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }}>Delete</button>
                                            </div>
                                            <span className={`badge ${course.is_active ? 'active' : 'none'}`}>{course.is_active ? 'Active' : 'Draft'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'push' && (
                    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', border: '1px solid #bfdbfe' }}>
                            <h4 style={{ color: '#1e40af', marginBottom: '0.25rem' }}>Method 2: OneSignal (Reliable & Pro)</h4>
                            <p style={{ fontSize: '0.85rem', color: '#1e40af' }}>This method bypasses Google Cloud errors and works on all browsers including Safari (iPhone).</p>
                        </div>

                        <div className="flex-col gap-1 flex">
                            <div className="grid grid-cols-2 gap-1">
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>OneSignal App ID</label>
                                    <input type="text" placeholder="Paste App ID..." value={oneSignalAppId} onChange={(e) => setOneSignalAppId(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>REST API Key</label>
                                    <input type="password" placeholder="Paste REST Key..." value={oneSignalRestKey} onChange={(e) => setOneSignalRestKey(e.target.value)} />
                                </div>
                            </div>

                            <div className="mt-1">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Message Title</label>
                                <input type="text" placeholder="e.g. 📢 Important Update!" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Message Body</label>
                                <textarea placeholder="Write your message here..." value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows="3" />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Action Link (URL)</label>
                                <input type="text" placeholder="https://yourlink.com" value={pushLink} onChange={(e) => setPushLink(e.target.value)} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Large Image URL</label>
                                <input type="text" placeholder="https://image-url.jpg" value={pushImage} onChange={(e) => setPushImage(e.target.value)} />
                            </div>

                            {pushStatus && (
                                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', backgroundColor: '#f3f4f6', fontSize: '0.9rem', fontWeight: 500 }}>
                                    {pushStatus}
                                </div>
                            )}

                            <button className="btn-primary mt-1" onClick={handleSendOneSignalPush} style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <span>Send Push Broadcast</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                )}

                {showModal && activeTab === 'courses' && (
                    <div className="overlay">
                        <div className="modal" style={{ maxWidth: '750px' }}>
                            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{editingCourse ? 'Edit course' : 'Add course'}</h3>
                                {!editingCourse && <button className="btn-ghost" style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: '0.9rem' }}>Import with key</button>}
                            </div>

                            <div className="modal-body flex-col gap-1">
                                <div className="flex-col" style={{ position: 'relative' }}>
                                    <input
                                        placeholder="Course name"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        style={{ border: '1px solid var(--border-color)', padding: '1.25rem', fontSize: '1.1rem' }}
                                    />
                                    <span style={{ position: 'absolute', right: '1rem', bottom: '-1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{title.length} / 50</span>
                                </div>

                                <div className="flex-col mt-1" style={{ position: 'relative' }}>
                                    <textarea
                                        placeholder="Course description"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        style={{ minHeight: '120px', padding: '1.25rem', border: '1px solid var(--border-color)' }}
                                    />
                                    <span style={{ position: 'absolute', right: '1rem', bottom: '-1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description.length} / 500</span>
                                </div>

                                <div className="access-options mt-2">
                                    {[
                                        { id: 'Open', title: 'Open', desc: 'All members can access.' },
                                        { id: 'Level unlock', title: 'Level unlock', desc: 'Members unlock at a specific level.' },
                                        { id: 'Buy now', title: 'Buy now', desc: 'Members pay a 1-time price to unlock.' },
                                        { id: 'Time unlock', title: 'Time unlock', desc: 'Members unlock after x days.' },
                                        { id: 'Private', title: 'Private', desc: 'Members on a tier or specific members.' }
                                    ].map(opt => (
                                        <div
                                            key={opt.id}
                                            className={`access-option ${accessLevel === opt.id ? 'selected' : ''}`}
                                            onClick={() => setAccessLevel(opt.id)}
                                            style={{ padding: '1rem 0.5rem', borderRight: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left', minHeight: '120px' }}
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <div style={{
                                                    width: '18px', height: '18px', borderRadius: '50%', border: accessLevel === opt.id ? '5px solid var(--primary-color)' : '2px solid #cbd5e1',
                                                    flexShrink: 0
                                                }}></div>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{opt.title}</span>
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>{opt.desc}</p>
                                        </div>
                                    ))}
                                </div>

                                {accessLevel === 'Buy now' && (
                                    <div className="animate-up" style={{ backgroundColor: '#f9fafb', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>Price ($)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-muted)' }}>$</span>
                                            <input
                                                type="number"
                                                placeholder="99"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                style={{ paddingLeft: '2rem', fontSize: '1.1rem', fontWeight: 600 }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ backgroundColor: '#f9fafb', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>Fake Members Count (Social Proof)</label>
                                    <input
                                        type="number"
                                        placeholder="Enter number e.g. 500"
                                        value={fakeMembers}
                                        onChange={e => setFakeMembers(e.target.value)}
                                        style={{ fontSize: '1.1rem', fontWeight: 600 }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Real members who join will be added on top of this number.</p>
                                </div>

                                <div className="flex gap-2 items-center mt-1" style={{ backgroundColor: '#f0fdf4', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid #bbf7d0' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#166534' }}>Enable 30% Discount UI</h4>
                                        <p style={{ fontSize: '0.85rem', color: '#166534' }}>Show original price crossed out and "SAVE 30% TODAY" badge.</p>
                                    </div>
                                    <label className="switch">
                                        <input type="checkbox" checked={showDiscount} onChange={e => setShowDiscount(e.target.checked)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                <div className="flex gap-2 items-center mt-1" style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ width: '280px', height: '160px', backgroundColor: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {coverImage ? (
                                            <img src={coverImage} alt="Cover Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div className="text-muted" style={{ fontWeight: 600 }}>Preview Area</div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Cover</h4>
                                        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>1460 x 752 px</p>
                                        <div className="flex-col gap-1">
                                            <input
                                                type="text"
                                                placeholder="Paste image link here..."
                                                value={coverImage}
                                                onChange={e => setCoverImage(e.target.value)}
                                                style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                                            />
                                            <button className="btn-outline" style={{ width: 'max-content', padding: '0.5rem 1.5rem', fontWeight: 600 }}>CHANGE</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer" style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
                                <div className="flex items-center gap-1">
                                    <span style={{ fontWeight: 600, color: published ? 'var(--success-color)' : 'var(--text-muted)' }}>Published</span>
                                    <label className="switch">
                                        <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="flex gap-1">
                                    <button className="btn-ghost" onClick={() => { setShowModal(false); setEditingCourse(null); }} style={{ fontWeight: 700, color: 'var(--text-muted)' }}>CANCEL</button>
                                    <button
                                        className="btn-primary"
                                        onClick={handleAddCourse}
                                        disabled={submitting}
                                        style={{ padding: '0.75rem 2rem', fontWeight: 700, backgroundColor: submitting ? '#e2e8f0' : 'var(--primary-color)', color: submitting ? '#94a3b8' : 'white' }}
                                    >
                                        {submitting ? 'SAVING...' : (editingCourse ? 'UPDATE' : 'ADD')}
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
