import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { useStore } from './store/useStore';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Auth from './pages/Auth';
import DashboardUser from './pages/DashboardUser';
import DashboardAdmin from './pages/DashboardAdmin';
import PaymentPage from './pages/PaymentPage';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';

const ProtectedRoute = ({ children, requireAuth, requireAdmin, requireActive }) => {
  const { user, loading } = useStore();

  if (loading) return <div className="container text-center mt-2">Loading...</div>;

  if (requireAuth && !user) return <Navigate to="/auth" />;
  if (requireAdmin && user?.role !== 'admin') return <Navigate to="/dashboard" />;
  if (requireActive) {
    if (user?.role === 'admin') return children; // Admins always have access
    if (user?.blocked) return <Navigate to="/dashboard" />;
    if (user?.subscription_status !== 'active') return <Navigate to="/payment" />;
  }

  return children;
};

const App = () => {
  const { setUser, setLoading } = useStore();

  useEffect(() => {
    let unsubSnapshot = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Listen to user document changes in real-time
        const docRef = doc(db, 'users', firebaseUser.uid);
        unsubSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ uid: firebaseUser.uid, ...docSnap.data() });
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } else {
        if (unsubSnapshot) unsubSnapshot();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [setUser, setLoading]);

  return (
    <Router>
      <Navbar />
      <div className="container" style={{ paddingBottom: '2rem' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />

          <Route path="/dashboard" element={
            <ProtectedRoute requireAuth={true}>
              <DashboardUser />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute requireAuth={true} requireAdmin={true}>
              <DashboardAdmin />
            </ProtectedRoute>
          } />

          <Route path="/payment" element={
            <ProtectedRoute requireAuth={true}>
              <PaymentPage />
            </ProtectedRoute>
          } />

          <Route path="/courses" element={
            <ProtectedRoute requireAuth={true}>
              <Courses />
            </ProtectedRoute>
          } />

          <Route path="/course/:id" element={
            <ProtectedRoute requireAuth={true}>
              <CourseDetails />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
