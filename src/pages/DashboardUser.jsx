import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

const DashboardUser = () => {
    const { user } = useStore();
    const navigate = useNavigate();

    if (!user) return null;

    return (
        <div className="container mt-2">
            <h2>Welcome, {user.email.split('@')[0]}</h2>

            <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="card">
                    <h3 className="mb-1">Account Status</h3>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Role:</strong> {user.role}</p>
                    <p className="mt-1">
                        <strong>Status: </strong>
                        <span className={`badge ${user.subscription_status}`}>
                            {user.subscription_status}
                        </span>
                    </p>
                    {user.expiry_date && (
                        <p className="mt-1"><strong>Expiry Date:</strong> {new Date(user.expiry_date).toLocaleDateString()}</p>
                    )}

                    <div className="card">
                        <h3 className="mb-1">Classroom Access</h3>
                        <p className="text-muted mb-2">Access your free and purchased courses from here.</p>

                        <div className="flex-col gap-1 flex">
                            <button className="btn-primary" onClick={() => navigate('/courses')}>
                                Go to Classroom
                            </button>

                            <div className="mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <p><strong>Unlocked Courses:</strong> {(user.unlocked_courses || []).length}</p>
                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    {(user.unlocked_courses || []).length === 0
                                        ? "You haven't purchased any premium courses yet."
                                        : "You have access to premium content."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardUser;
