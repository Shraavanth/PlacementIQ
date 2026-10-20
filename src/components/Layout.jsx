import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  UserCircle2,
  X
} from 'lucide-react';

export default function Layout({ title, children, role = 'student' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const notifRef = useRef(null);

  const token = localStorage.getItem('token');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && active) {
          const data = await res.json();
          setUnreadCount(data.unread_count || 0);
          setRecentNotifs((data.notifications || []).slice(0, 4));
        }
      } catch (_) {
        // silent fallback
      }
    };
    fetchNotifications();
    return () => { active = false; };
  }, [token, location.pathname]);

  // Close dropdown on external click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = {
    student: [
      { label: 'Dashboard', to: '/student', icon: LayoutDashboard },
      { label: 'Profile & Skills', to: '/student/profile', icon: UserCheck },
      { label: 'Resume & Evidence', to: '/resume', icon: FileText },
      { label: 'Job Opportunities', to: '/jobs', icon: FileCheck2 },
      { label: 'Career & Twin', to: '/career', icon: Compass },
      { label: 'Notifications', to: '/notifications', icon: Bell }
    ],
    recruiter: [
      { label: 'Hiring Dashboard', to: '/recruiter', icon: LayoutDashboard },
      { label: 'Job Posting', to: '/recruiter/jobs', icon: FileCheck2 },
      { label: 'Notifications', to: '/notifications', icon: Bell }
    ],
    officer: [
      { label: 'Placement Analytics', to: '/officer', icon: LayoutDashboard },
      { label: 'All Jobs', to: '/jobs', icon: FileCheck2 },
      { label: 'Notifications', to: '/notifications', icon: Bell }
    ],
    admin: [
      { label: 'System Overview', to: '/admin', icon: ShieldCheck },
      { label: 'Job Moderation', to: '/jobs', icon: FileCheck2 },
      { label: 'Notifications', to: '/notifications', icon: Bell }
    ]
  };

  const currentItems = navItems[role] || navItems.student;

  return (
    <div className="min-h-screen bg-[#F5F2E9] text-[#242820]">
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-[#DFD9CC] bg-[#FAF8F3] p-6 lg:flex lg:flex-col lg:justify-between z-20">
        <div>
          <div className="mb-8">
            <Link to="/" className="inline-block">
              <span className="editorial-serif text-2xl font-bold tracking-tight text-[#214C3A]">PlacementIQ</span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#77776C] font-semibold mt-0.5">Career Intelligence System</p>
            </Link>
          </div>

          <nav className="space-y-1.5">
            {currentItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#214C3A] text-white shadow-sm font-semibold'
                      : 'text-[#474D41] hover:bg-[#EAE4D5] hover:text-[#242820]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-[#DDE8D8]' : 'text-[#77776C]'} />
                    <span>{item.label}</span>
                  </div>
                  {item.label === 'Notifications' && unreadCount > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-[#DDE8D8] text-[#214C3A]' : 'bg-[#214C3A] text-white'}`}>
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info & active account badge */}
        <div className="pt-6 border-t border-[#DFD9CC]/80">
          <div className="rounded-xl bg-white border border-[#DFD9CC] p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-[#DDE8D8] flex items-center justify-center text-[#214C3A] font-bold text-xs uppercase shrink-0">
                {role.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold capitalize truncate text-[#242820]">{role} Account</p>
                <p className="text-[10px] text-[#77776C] truncate">Verified session</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-[#77776C] hover:text-[#B91C1C] p-1.5 rounded-lg hover:bg-[#FAF8F3] transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-[#FAF8F3] p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <Link to="/" className="editorial-serif text-2xl font-bold text-[#214C3A]">PlacementIQ</Link>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-[#EAE4D5]">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-1">
                {currentItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-[#214C3A] text-white' : 'text-[#474D41] hover:bg-[#EAE4D5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </div>
                      {item.label === 'Notifications' && unreadCount > 0 && (
                        <span className="rounded-full bg-[#214C3A] text-white px-2 py-0.5 text-xs font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-[#DFD9CC] bg-white px-4 py-2.5 text-sm font-medium text-[#B91C1C]"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:ml-72 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-10 border-b border-[#DFD9CC] bg-[#FAF8F3]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-[#DFD9CC] bg-white text-[#242820] hover:bg-[#FAF8F3]"
                aria-label="Open navigation menu"
              >
                <Menu size={20} />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77776C]">PlacementIQ Intelligence</p>
                <h1 className="editorial-serif text-xl sm:text-2xl font-medium tracking-tight text-[#242820]">{title}</h1>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Notifications with interactive badge & dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  aria-label="View notifications"
                  onClick={() => setNotifDropdownOpen((prev) => !prev)}
                  className="relative rounded-full border border-[#DFD9CC] bg-white p-2.5 text-[#474D41] hover:bg-[#FAF8F3] hover:text-[#214C3A] transition shadow-sm"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#214C3A] text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Preview */}
                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#DFD9CC] bg-white p-4 shadow-lifted z-30 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 border-b border-[#DFD9CC]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="badge bg-[#DDE8D8] text-[#214C3A] font-bold">{unreadCount} new</span>
                        )}
                      </div>
                      <Link
                        to="/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="text-xs font-semibold text-[#214C3A] hover:underline"
                      >
                        Open Center
                      </Link>
                    </div>

                    <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto">
                      {recentNotifs.length > 0 ? (
                        recentNotifs.map((n) => (
                          <Link
                            key={n.id}
                            to={n.link || '/notifications'}
                            onClick={() => setNotifDropdownOpen(false)}
                            className="block rounded-xl p-2.5 hover:bg-[#FAF8F3] transition border border-transparent hover:border-[#DFD9CC]"
                          >
                            <p className="text-xs font-semibold text-[#242820]">{n.title}</p>
                            <p className="text-xs text-[#77776C] line-clamp-2 mt-0.5">{n.message}</p>
                          </Link>
                        ))
                      ) : (
                        <p className="py-4 text-center text-xs text-[#77776C]">No notifications to show.</p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#DFD9CC] text-center">
                      <Link
                        to="/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        className="text-xs font-semibold text-[#214C3A] hover:underline inline-flex items-center gap-1"
                      >
                        View all persistent alerts <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Role badge */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#DFD9CC] bg-white px-3 py-1.5 shadow-sm">
                <UserCircle2 size={16} className="text-[#214C3A]" />
                <span className="text-xs font-semibold capitalize text-[#242820]">{role}</span>
              </div>

              <button
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#DFD9CC] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#474D41] hover:text-[#B91C1C] hover:border-[#FEE2E2] hover:bg-[#FEF2F2] transition shadow-sm"
                onClick={logout}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-[#DFD9CC]/70 bg-[#FAF8F3]/60 py-6 text-center text-xs text-[#77776C]">
          <p>PlacementIQ — AI-Based Placement Management & Career Guidance System • University Placement Portal</p>
        </footer>
      </div>
    </div>
  );
}
