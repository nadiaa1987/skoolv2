import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
    return (
        <div className="container text-center mt-2">
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                Unlock Premium Online Courses
            </h1>
            <p className="text-muted" style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
                Join our exclusive platform to access top-tier content, master new skills, and advance your career.
            </p>
            <Link to="/auth" className="btn-primary" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
                Get Started Today
            </Link>
        </div>
    );
};

export default Home;
