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

function App() {
  useLocation();
  const role = localStorage.getItem('role');
  const isAuthed = Boolean(localStorage.getItem('token'));

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
      <Route path="/officer" element={isAuthed && role === 'officer' ? <OfficerDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="/admin" element={isAuthed && role === 'admin' ? <AdminDashboard /> : <Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
