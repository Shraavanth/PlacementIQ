import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import StudentDashboard from './pages/StudentDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StudentProfile from './pages/StudentProfile';
import JobsPage from './pages/JobsPage';
import JobDetailsPage from './pages/JobDetailsPage';
import ResumePage from './pages/ResumePage';
import CareerGuidancePage from './pages/CareerGuidancePage';
import NotificationsPage from './pages/NotificationsPage';
import RecruiterJobPostings from './pages/RecruiterJobPostings';

function App() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [verifiedRole, setVerifiedRole] = useState('');
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    if (!token) {
      setVerifiedRole('');
      setAuthLoading(false);
      return () => { active = false; };
    }
    setAuthLoading(true);
    setAuthError('');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Your session could not be verified.');
        if (!data.user?.role) throw new Error('The server did not return an assigned account role.');
        if (active) {
          setVerifiedRole(data.user.role);
          localStorage.setItem('role', data.user.role);
        }
      })
      .catch(() => {
        if (active) {
          setVerifiedRole('');
          setAuthError('Your assigned account role could not be verified. Check your connection and sign in again.');
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, [token, location.pathname]);

  const isAuthed = Boolean(token && verifiedRole);
  const role = verifiedRole;

  if (authLoading || (token && !verifiedRole)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F2E9] font-serif text-[#214C3A]">
        {authError
          ? <p role="alert" className="max-w-md text-center">{authError} <a href="/auth" className="underline">Go to sign in</a></p>
          : <p role="status">Verifying your account...</p>}
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/student" element={isAuthed && role === 'student' ? <StudentDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="/student/profile" element={isAuthed && role === 'student' ? <StudentProfile /> : <Navigate to="/auth" replace />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
      <Route path="/resume" element={isAuthed && role === 'student' ? <ResumePage /> : <Navigate to="/auth" replace />} />
      <Route path="/career" element={isAuthed && role === 'student' ? <CareerGuidancePage /> : <Navigate to="/auth" replace />} />
      <Route path="/notifications" element={isAuthed ? <NotificationsPage /> : <Navigate to="/auth" replace />} />
      <Route path="/recruiter" element={isAuthed && role === 'recruiter' ? <RecruiterDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="/recruiter/jobs" element={isAuthed && role === 'recruiter' ? <RecruiterJobPostings /> : <Navigate to="/auth" replace />} />
      <Route path="/officer" element={isAuthed && role === 'officer' ? <OfficerDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="/admin" element={isAuthed && role === 'admin' ? <AdminDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
