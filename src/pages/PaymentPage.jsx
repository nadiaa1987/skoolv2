import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useStore } from '../store/useStore';

const PaymentPage = () => {
    const { user, setUser } = useStore();
    const navigate = useNavigate();
    const { search } = useLocation();
    const courseId = new URLSearchParams(search).get('courseId');

    const [amount, setAmount] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [courseTitle, setCourseTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [coursePrice, setCoursePrice] = useState(99);
    const [loadingCourse, setLoadingCourse] = useState(!!courseId);

    useEffect(() => {
        if (courseId) {
            const fetchCourse = async () => {
                const snap = await getDoc(doc(db, 'courses', courseId));
                if (snap.exists()) {
                    const data = snap.data();
                    setCourseTitle(data.title);
                    setCoursePrice(data.price || 99);
                    setAmount(data.price || 99); // Auto-fill amount for convenience
                }
                setLoadingCourse(false);
            };
            fetchCourse();
        } else {
            setAmount(99); // Default subscription price
        }
    }, [courseId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!screenshotUrl || !amount) {
            setError('Please provide amount and receipt image URL');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Create payment record
            const paymentData = {
                user_id: user.uid,
                user_email: user.email,
                course_id: courseId || 'platform_subscription',
                course_title: courseTitle || 'Full Access',
                amount: Number(amount),
                screenshot_url: screenshotUrl,
                status: 'pending',
                created_at: new Date().toISOString(),
                approved_at: null
            };

            await addDoc(collection(db, 'payments'), paymentData);

            // 2. Update user status if it's a global subscription
            if (!courseId) {
                await updateDoc(doc(db, 'users', user.uid), {
                    subscription_status: 'pending'
                });
                setUser({ ...user, subscription_status: 'pending' });
            }

            navigate('/dashboard');
        } catch (err) {
            console.error("Payment error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const [copySuccess, setCopySuccess] = useState('');
    const trc20Address = "TCtoXDm4EKRRJWAs3ueN49C4y72zDVNhfz";

    const handleCopy = () => {
        navigator.clipboard.writeText(trc20Address);
        setCopySuccess('Address Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    return (
        <div className="container mt-2 flex justify-center" style={{ paddingBottom: '3rem' }}>
            <div className="card" style={{ maxWidth: '600px', width: '100%', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 className="heading-lg">{courseTitle ? `Enroll in ${courseTitle}` : 'Manual Payment'}</h2>
                    <p className="text-muted">Choose your preferred payment method below and upload a receipt.</p>

                    <div style={{
                        marginTop: '1.5rem',
                        backgroundColor: '#f8fafc',
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border-color)',
                        display: 'inline-block',
                        minWidth: '200px'
                    }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total to Pay</p>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>${coursePrice}</h2>
                    </div>
                </div>

                {/* Payment Methods Grid */}
                <div className="grid grid-cols-2 gap-1 mb-2">
                    {/* Wise Card */}
                    <div className="card" style={{ border: '2px solid #00b9ff', backgroundColor: 'rgba(0, 185, 255, 0.02)', padding: '1.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌐</div>
                        <h4 style={{ color: '#00b9ff', fontWeight: 700 }}>Wise (TransferWise)</h4>
                        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Fast & low-cost currency transfers.</p>
                        <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid #e5e7eb', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, wordBreak: 'break-all' }}>
                            NADIA KHALYL
                        </div>
                        <a
                            href="https://wise.com/pay/me/nadiak396"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary mt-1"
                            style={{ backgroundColor: '#00b9ff', width: '100%', fontSize: '0.85rem', padding: '0.6rem' }}
                        >
                            Pay with Wise
                        </a>
                    </div>

                    {/* USDT Card */}
                    <div className="card" style={{ border: '2px solid #26a17b', backgroundColor: 'rgba(38, 161, 123, 0.02)', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>₮</div>
                        <h4 style={{ color: '#26a17b', fontWeight: 700 }}>USDT (TRC20)</h4>
                        <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Instant crypto payment via Tron network.</p>
                        <div style={{ position: 'relative' }}>
                            <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid #e5e7eb', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'left', marginBottom: '1rem' }}>
                                {trc20Address}
                            </div>
                            <button
                                onClick={handleCopy}
                                className="btn-outline"
                                style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem', border: '1px solid #26a17b', color: '#26a17b' }}
                            >
                                {copySuccess || 'Copy Wallet Address'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="divider" style={{ margin: '2rem 0', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                    SUBMIT RECEIPT
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                </div>

                {error && <div className="text-danger mb-1" style={{ textAlign: 'center', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius)' }}>{error}</div>}

                <form onSubmit={handleSubmit} className="flex-col gap-1 flex">
                    <div className="grid grid-cols-2 gap-1">
                        <div>
                            <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Amount Paid ($)</label>
                            <input
                                type="number"
                                placeholder="e.g. 99"
                                required
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{ padding: '0.8rem' }}
                            />
                        </div>
                        <div>
                            <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Screenshot URL</label>
                            <input
                                type="text"
                                placeholder="Link to receipt..."
                                required
                                value={screenshotUrl}
                                onChange={e => setScreenshotUrl(e.target.value)}
                                style={{ padding: '0.8rem' }}
                            />
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Upload your receipt to <a href="https://postimages.org" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>PostImages</a> or Imgur and paste the direct link here.
                    </p>

                    <button type="submit" className="btn-primary mt-1" disabled={loading} style={{ padding: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>
                        {loading ? 'Verifying...' : 'Submit Approval Request'}
                    </button>

                    <p style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', marginTop: '1rem' }}>
                        Our team will verify your transaction within 1-12 hours.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default PaymentPage;
