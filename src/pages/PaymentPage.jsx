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

    useEffect(() => {
        if (courseId) {
            const fetchCourse = async () => {
                const snap = await getDoc(doc(db, 'courses', courseId));
                if (snap.exists()) {
                    setCourseTitle(snap.data().title);
                }
            };
            fetchCourse();
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

    return (
        <div className="container mt-2 flex justify-center">
            <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
                <h2 className="mb-1">{courseTitle ? `Payment for: ${courseTitle}` : 'Manual Bank Transfer'}</h2>
                <p className="text-muted mb-2">
                    {courseTitle
                        ? `To unlock "${courseTitle}", please transfer the fee and provide the receipt link.`
                        : "Please transfer the subscription fee to the bank account below, then provide a link to your receipt/screenshot."
                    }
                </p>

                <div className="mb-2" style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius)' }}>
                    <p><strong>Bank Name:</strong> CIH Bank</p>
                    <p className="mt-1"><strong>Account Name:</strong> SkoolClone Admin</p>
                    <p className="mt-1"><strong>RIB / IBAN:</strong> 1234 5678 9101 1121</p>
                    <p className="mt-1"><strong>Price:</strong> $99.00 / Month</p>
                </div>

                {error && <div className="text-danger mb-1">{error}</div>}

                <form onSubmit={handleSubmit} className="flex-col gap-1 flex">
                    <div>
                        <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Amount transferred</label>
                        <input
                            type="number"
                            placeholder="e.g. 99"
                            required
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Receipt Image URL</label>
                        <input
                            type="text"
                            placeholder="https://imgur.com/your-receipt.jpg"
                            required
                            value={screenshotUrl}
                            onChange={e => setScreenshotUrl(e.target.value)}
                        />
                        <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                            Tip: You can use services like Imgur or PostImages to upload your screenshot and paste the link here.
                        </p>
                    </div>

                    <button type="submit" className="btn-primary mt-1" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Payment Request'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaymentPage;
