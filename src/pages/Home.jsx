import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

const Home = () => {
    const { user } = useStore();

    return (
        <div className="home-wrapper">
            {/* Hero Section */}
            <section className="hero-gradient section-padding">
                <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="animate-up" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', padding: '0.4rem 1rem', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        The #1 Passive Income Methodology
                    </div>
                    <h1 className="heading-xl animate-up" style={{ maxWidth: '900px', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                        Build a <span style={{ color: 'var(--primary-color)' }}>Passive Income</span> Engine That Runs for a Lifetime
                    </h1>
                    <p className="text-muted animate-up" style={{ fontSize: '1.25rem', maxWidth: '700px', marginBottom: '2.5rem', transitionDelay: '0.1s' }}>
                        Stop trading your time for money. Master the art of digital assets, SaaS automation, and high-convert SEO strategies to secure your financial future.
                    </p>
                    <div className="flex gap-1 animate-up" style={{ transitionDelay: '0.2s' }}>
                        {user ? (
                            <Link to="/dashboard" className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 600, boxShadow: 'var(--shadow-lg)' }}>
                                Go to Dashboard
                            </Link>
                        ) : (
                            <Link to="/auth" className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 600, boxShadow: 'var(--shadow-lg)' }}>
                                Join Now
                            </Link>
                        )}
                        <Link to="/courses" className="btn-outline" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 600, backgroundColor: 'white' }}>
                            View Courses
                        </Link>
                    </div>


                    <div className="animate-fade mt-2" style={{ transitionDelay: '0.4s', opacity: 0.7 }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Trusted by 5,000+ digital entrepreneurs worldwide</p>
                    </div>
                </div>
            </section>

            {/* Mastery Section: Digital Products */}
            <section className="section-padding" style={{ backgroundColor: 'white' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 className="heading-lg mb-1">Master Digital Product Mastery</h2>
                        <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                            Learn how to package your knowledge into digital products that sell while you sleep.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {[
                            {
                                icon: '🛍️',
                                title: 'Etsy & Marketplace Domination',
                                desc: 'Unlock the secret to high-demand printables and templates that trend on Etsy and Creative Market.'
                            },
                            {
                                icon: '🚀',
                                title: 'Shopify Global Scaling',
                                desc: 'Build a high-converting digital storefront that runs autonomously with global payment gateways.'
                            },
                            {
                                icon: '💼',
                                title: 'WordPress & PLR Profits',
                                desc: 'Leverage the power of self-hosted assets and Private Label Rights to launch brands in days, not months.'
                            }
                        ].map((item, i) => (
                            <div key={i} className="card" style={{ border: 'none', boxShadow: 'var(--shadow-md)', transition: 'transform 0.3s' }}>
                                <div className="feature-icon" style={{ fontSize: '1.5rem' }}>{item.icon}</div>
                                <h3 className="heading-md mb-1">{item.title}</h3>
                                <p className="text-muted" style={{ fontSize: '0.95rem' }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Diverse Streams Section: SaaS, SEO, Pinterest */}
            <section className="section-padding" style={{ backgroundColor: 'var(--bg-alt)' }}>
                <div className="container">
                    <div className="grid grid-cols-2 gap-2 items-center">
                        <div>
                            <h2 className="heading-lg mb-1">Beyond Basic Selling</h2>
                            <p className="text-muted mb-2" style={{ fontSize: '1.1rem' }}>
                                We don't just teach you how to sell; we teach you how to automate. Explore high-performance strategies that scale without your constant presence.
                            </p>

                            <div className="flex-col gap-1 flex">
                                {[
                                    { title: 'SaaS & App Development (No-Code)', desc: 'Build recurring revenue software without writing a single line of code.' },
                                    { title: 'Advanced SEO & Content Machines', desc: 'Rank #1 on Google and turn search traffic into a 24/7 sales force.' },
                                    { title: 'Pinterest Automation & Traffic', desc: 'Harness the visual discovery engine to drive millions of visitors to your assets.' }
                                ].map((list, j) => (
                                    <div key={j} className="flex gap-1 items-start">
                                        <div style={{ color: 'var(--success-color)', marginTop: '4px' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <div>
                                            <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{list.title}</h4>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{list.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card glass animate-up" style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', backgroundColor: 'var(--primary-color)', opacity: 0.1, borderRadius: '50%' }}></div>
                            <h3 className="heading-md mb-1">{user ? 'Ready to continue learning?' : 'Join the Passive Income Revolution'}</h3>
                            <p className="mb-2">
                                {user
                                    ? 'Head over to the classroom to access your courses and community updates.'
                                    : 'Get access to over 50+ hours of premium video content, direct mentorship, and a community of like-minded builders.'}
                            </p>
                            {user ? (
                                <Link to="/courses" className="btn-primary w-full text-center" style={{ display: 'block', padding: '1rem' }}>
                                    Go to Classroom
                                </Link>
                            ) : (
                                <Link to="/auth" className="btn-primary w-full text-center" style={{ display: 'block', padding: '1rem' }}>
                                    Create Your Free Account
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer-like CTA (Only for Guests) */}
            {!user && (
                <section className="section-padding" style={{ backgroundColor: 'var(--text-main)', color: 'white' }}>
                    <div className="container text-center">
                        <h2 className="heading-lg mb-1" style={{ color: 'white' }}>Ready to Scale Your Digital Empire?</h2>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.25rem', maxWidth: '700px', margin: '0 auto 2.5rem' }}>
                            The difference between dreaming and doing is the right framework. Start building today.
                        </p>
                        <Link to="/auth" className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--text-main)', padding: '1.25rem 3rem', fontSize: '1.2rem', fontWeight: 800 }}>
                            Enroll Now
                        </Link>
                    </div>
                </section>
            )}

            <footer style={{ padding: '2rem 0', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <div className="container">
                    &copy; {new Date().getFullYear()} Web Skool Digital. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default Home;
