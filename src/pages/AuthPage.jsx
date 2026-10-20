import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserCheck, Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const initialForm = { firstName: '', lastName: '', email: '', password: '', role: 'student' };

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState(initialForm);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (mode === 'login') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        const routeMap = { student: '/student', recruiter: '/recruiter', officer: '/officer', admin: '/admin' };
        const returnTo = location.state?.from;
        navigate(
          data.user.role === 'student' && returnTo ? returnTo : routeMap[data.user.role] || '/student',
          { replace: true }
        );
      } else {
        setMode('login');
        setForm(initialForm);
        alert('Registration successful. Please sign in with your credentials.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset request failed.');
      setResetMessage(data.message || 'Password reset successfully. You can now log in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2E9] p-4 md:p-8 lg:p-12 flex items-center justify-center">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-[#DFD9CC] bg-white shadow-lifted grid lg:grid-cols-12">
        {/* Left Editorial Panel */}
        <div className="lg:col-span-5 bg-[#214C3A] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle botanical line motif */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-8 -bottom-8 h-48 w-48 rounded-full border border-white/10" />

          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#DDE8D8] hover:text-white transition">
              <ArrowLeft size={14} /> Back to PlacementIQ
            </Link>
            <div className="mt-8">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#DDE8D8] border border-white/15">
                Institutional Career Intelligence
              </span>
              <h1 className="editorial-serif mt-4 text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-[#FAF8F3] leading-[1.15]">
                {mode === 'register' ? 'Join the future of placement.' : 'Your next career move starts here.'}
              </h1>
              <p className="mt-5 text-sm md:text-base text-[#DDE8D8]/85 leading-relaxed">
                Empower students, recruiters, and placement officers with explainable eligibility, verified skills, and predictive career guidance.
              </p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/15 space-y-3">
            <div className="flex items-center gap-3 text-xs text-[#DDE8D8]">
              <ShieldCheck size={16} className="text-[#DDE8D8] shrink-0" />
              <span>Rules-based matching with 100% explainability</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#DDE8D8]">
              <Sparkles size={16} className="text-[#DDE8D8] shrink-0" />
              <span>Evidence-backed skills & Placement Readiness Twin</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 md:p-12 flex flex-col justify-center bg-white">
          {mode !== 'forgot' ? (
            <>
              {/* Mode Toggle Tabs */}
              <div className="mb-8 flex rounded-xl border border-[#DFD9CC] bg-[#FAF8F3] p-1.5">
                <button
                  type="button"
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-[#214C3A] text-white shadow-sm' : 'text-[#77776C] hover:text-[#242820]'}`}
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-[#214C3A] text-white shadow-sm' : 'text-[#77776C] hover:text-[#242820]'}`}
                  onClick={() => { setMode('register'); setError(''); }}
                >
                  Register
                </button>
              </div>

              <div className="mb-6">
                <h2 className="editorial-serif text-2xl md:text-3xl font-medium text-[#242820]">
                  {mode === 'login' ? 'Sign in to your account' : 'Create your PlacementIQ account'}
                </h2>
                <p className="mt-1 text-xs md:text-sm text-[#77776C]">
                {mode === 'login' ? 'Enter your institutional email to access your dashboard.' : 'Create a student or recruiter account. Placement officer access is provisioned by an administrator.'}
                </p>
              </div>

              <form className="space-y-4" onSubmit={submit}>
                {mode === 'register' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-group">
                      <label htmlFor="auth-first-name" className="form-label">First name</label>
                      <input
                        id="auth-first-name"
                        className="input"
                        name="firstName"
                        placeholder="e.g. Aditi"
                        value={form.firstName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="auth-last-name" className="form-label">Last name</label>
                      <input
                        id="auth-last-name"
                        className="input"
                        name="lastName"
                        placeholder="e.g. Sharma"
                        value={form.lastName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email Field with guaranteed icon isolation */}
                <div className="form-group">
                  <label htmlFor="auth-email" className="form-label">Email address</label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 flex items-center text-[#77776C]">
                      <Mail size={18} />
                    </span>
                    <input
                      id="auth-email"
                      className="input input-with-icon-left"
                      name="email"
                      type="email"
                      placeholder="Email address"
                      value={form.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="form-group">
                    <label htmlFor="auth-role" className="form-label">Account role</label>
                    <select
                      id="auth-role"
                      className="input"
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                    >
                      <option value="student">Student — Career guidance & applications</option>
                      <option value="recruiter">Recruiter — Post jobs & manage pipeline</option>
                    </select>
                  </div>
                )}

                {/* Password Field with guaranteed icon & toggle isolation */}
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label htmlFor="auth-password" className="form-label">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        className="text-xs font-medium text-[#214C3A] hover:underline"
                        onClick={() => { setMode('forgot'); setError(''); }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 flex items-center text-[#77776C]">
                      <LockKeyhole size={18} />
                    </span>
                    <input
                      id="auth-password"
                      className="input input-with-icons"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 flex items-center text-[#77776C] hover:text-[#242820] transition focus:outline-none p-1 rounded-md"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs md:text-sm text-[#B91C1C]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary w-full mt-2"
                  disabled={loading}
                >
                  {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>
            </>
          ) : (
            /* Forgot Password Form */
            <div>
              <button
                type="button"
                className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#214C3A] hover:underline"
                onClick={() => { setMode('login'); setError(''); setResetMessage(''); }}
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
              <h2 className="editorial-serif text-2xl md:text-3xl font-medium text-[#242820]">Reset your password</h2>
              <p className="mt-1 text-sm text-[#77776C]">Enter your registered institutional email and choose a new password.</p>

              <form className="mt-6 space-y-4" onSubmit={handleReset}>
                <div className="form-group">
                  <label htmlFor="reset-email" className="form-label">Email address</label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 text-[#77776C]"><Mail size={18} /></span>
                    <input
                      id="reset-email"
                      className="input input-with-icon-left"
                      type="email"
                      placeholder="Email address"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reset-new-password" className="form-label">New password (minimum 8 characters)</label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3.5 text-[#77776C]"><LockKeyhole size={18} /></span>
                    <input
                      id="reset-new-password"
                      className="input input-with-icon-left"
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && <div role="alert" className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]">{error}</div>}
                {resetMessage && <div role="status" className="rounded-xl border border-[#D5E4D7] bg-[#EAF1EB] p-3 text-xs text-[#214C3A]">{resetMessage}</div>}

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'Resetting password...' : 'Update password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
