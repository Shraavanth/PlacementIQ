import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  Check, 
  ArrowRight, 
  Calendar, 
  Briefcase, 
  Sparkles,
  Inbox
} from 'lucide-react';
import Layout from '../components/Layout';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role') || 'student';

  const loadNotifications = async (active = true) => {
    if (!token) return;
    try {
      const response = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load notifications.');
      if (active) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count ?? (data.notifications?.filter(n => !n.read_at).length || 0));
      }
    } catch (err) {
      if (active) setError(err.message || 'Could not load notifications.');
    } finally {
      if (active) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadNotifications(active);
    return () => { active = false; };
  }, [token]);

  const markRead = async (id) => {
    setError('');
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update this notification.');
      setNotifications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || 'Could not update this notification.');
    }
  };

  const markAllRead = async () => {
    setError('');
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not mark all notifications as read.');
      setNotifications((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout title="Notification Center" role={role}>
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Institutional Alerts</span>
              <span className="text-xs text-muted-600 font-medium">Placement & Application Lifecycle</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Personalized Notifications & Dispatch
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Real-time updates regarding application status changes, scheduled interviews, 
              approaching requisition deadlines, and recruiter advisory notes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 shadow-soft"
              >
                <CheckCheck className="w-4 h-4 text-forest-800" />
                Mark all as read
              </button>
            )}
            <span className={`badge ${unreadCount > 0 ? 'badge-amber' : 'badge-sage'} text-xs font-semibold`}>
              {unreadCount} Unread
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-ruby-50 border border-ruby-200 p-4 text-xs text-ruby-800">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status" className="font-serif italic text-muted-600 py-10">
          Synchronizing notification records...
        </p>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isUnread = !notification.read_at;

            return (
              <article 
                key={notification.id} 
                className={`card p-5 border transition-all ${
                  isUnread 
                    ? 'bg-white border-forest-600/50 shadow-soft' 
                    : 'bg-warm-50/60 border-[#DFD9CC] opacity-80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${isUnread ? 'bg-forest-700' : 'bg-transparent'}`} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-serif font-bold text-base text-charcoal-900">
                          {notification.title}
                        </span>
                        {notification.created_at && (
                          <span className="text-[11px] text-muted-500">
                            • {new Date(notification.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-700 leading-relaxed font-sans">
                        {notification.message}
                      </p>

                      {/* Action Link if provided */}
                      {notification.link && (
                        <Link 
                          to={notification.link}
                          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-forest-800 hover:text-forest-900 underline"
                        >
                          View relevant item <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                    {isUnread ? (
                      <button 
                        type="button" 
                        className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        onClick={() => markRead(notification.id)}
                      >
                        <Check className="w-3.5 h-3.5" /> Mark read
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-400 font-medium">Read</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!notifications.length && !error && (
            <div className="card p-12 text-center bg-white border border-[#DFD9CC]">
              <Inbox className="w-10 h-10 text-muted-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-charcoal-900">No Notifications</h3>
              <p className="text-xs text-muted-600 mt-1">You have no notifications yet.</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
