import { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Briefcase, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building2,
  Lock,
  Unlock
} from 'lucide-react';
import Layout from '../components/Layout';

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  const loadAdmin = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard/admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load administrative governance console.');
      setAdminData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, [token]);

  const toggleUserStatus = async (userId, currentStatus) => {
    setError('');
    setMessage('');
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await fetch(`/api/dashboard/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update user status.');
      setMessage(`User account status updated to ${newStatus}.`);
      loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleJobStatus = async (jobId, currentStatus) => {
    setError('');
    setMessage('');
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
    try {
      const res = await fetch(`/api/dashboard/admin/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update job status.');
      setMessage(`Requisition #${jobId} status updated to ${newStatus}.`);
      loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  };

  const overview = adminData?.overview || {};

  return (
    <Layout title="Administrator Governance Console" role="admin">
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Module 1 System Governance</span>
              <span className="text-xs text-muted-600 font-medium">RBAC Security & Institutional Moderation</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Institutional Administrative Oversight
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Supervise user accounts, enforce account suspensions, moderate corporate job requisitions, 
              and review global placement throughput.
            </p>
          </div>
          <span className="badge badge-forest text-xs font-bold">
            Administrator Tier
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-ruby-50 border border-ruby-200 p-4 text-xs text-ruby-800">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mb-6 rounded-lg bg-sage-50 border border-sage-200 p-4 text-xs text-forest-800 font-semibold">
          {message}
        </p>
      )}

      {/* Metric Cards */}
      <div className="grid gap-5 md:grid-cols-4">
        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Total Accounts</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{overview.total_users || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-500">
            {overview.students || 0} Students • {overview.recruiters || 0} Recruiters • {overview.officers || 0} Officers
          </p>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Job Postings</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{overview.total_jobs || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-500">
            {overview.active_jobs || 0} Active Requisitions
          </p>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Applications Logged</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{overview.total_applications || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-500">
            Campus-wide portfolios
          </p>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Partner Employers</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-forest-900">{overview.total_companies || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-500">
            Verified corporate entities
          </p>
        </div>
      </div>

      {/* User Management Table */}
      <div className="mt-8 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex items-center justify-between pb-4 border-b border-[#ECE6D9] mb-4">
          <h3 className="font-serif font-bold text-lg text-charcoal-900">
            User Account Management & Access Controls
          </h3>
          <span className="badge badge-sage text-xs">
            {adminData?.users?.length || 0} Registered Users
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#ECE6D9] text-muted-600 uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3">User ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Moderation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE6D9]">
              {(adminData?.users || []).map((u) => (
                <tr key={u.id} className="hover:bg-warm-50/50">
                  <td className="py-3 px-3 font-mono text-muted-500">#{u.id}</td>
                  <td className="py-3 px-3 font-semibold text-charcoal-900">{u.name}</td>
                  <td className="py-3 px-3 text-charcoal-700">{u.email}</td>
                  <td className="py-3 px-3">
                    <span className="badge badge-sage capitalize font-semibold">{u.role}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`badge ${u.status === 'suspended' ? 'badge-amber' : 'badge-forest'} capitalize`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(u.id, u.status)}
                        className={`btn text-[11px] px-3 py-1 inline-flex items-center gap-1 ${
                          u.status === 'suspended' ? 'btn-primary' : 'btn-secondary text-ruby-700'
                        }`}
                      >
                        {u.status === 'suspended' ? (
                          <>
                            <Unlock className="w-3 h-3" /> Reactivate
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" /> Suspend
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Moderation Table */}
      <div className="mt-8 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex items-center justify-between pb-4 border-b border-[#ECE6D9] mb-4">
          <h3 className="font-serif font-bold text-lg text-charcoal-900">
            Requisition Moderation & Status Oversight
          </h3>
          <span className="badge badge-sage text-xs">
            {adminData?.recent_jobs?.length || 0} Recent Requisitions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#ECE6D9] text-muted-600 uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3">Requisition</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Min CGPA</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE6D9]">
              {(adminData?.recent_jobs || []).map((j) => (
                <tr key={j.id} className="hover:bg-warm-50/50">
                  <td className="py-3 px-3 font-semibold text-charcoal-900">#{j.id} — {j.title}</td>
                  <td className="py-3 px-3 text-charcoal-700">{j.company}</td>
                  <td className="py-3 px-3 text-muted-600">{j.location || 'Remote'}</td>
                  <td className="py-3 px-3">{j.min_cgpa || 'None'}</td>
                  <td className="py-3 px-3">
                    <span className={`badge ${j.status === 'active' ? 'badge-forest' : 'badge-amber'} capitalize`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleJobStatus(j.id, j.status)}
                      className="btn btn-secondary text-[11px] px-3 py-1"
                    >
                      {j.status === 'active' ? 'Archive' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
