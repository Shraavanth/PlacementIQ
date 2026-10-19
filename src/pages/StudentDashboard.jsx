import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Award, 
  Briefcase, 
  FileText, 
  Sparkles, 
  UserRound, 
  ArrowRight, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Sliders
} from 'lucide-react';
import Layout from '../components/Layout';

export default function StudentDashboard() {
  const [data, setData] = useState({ 
    profile: {}, 
    jobs: [], 
    recommendations: [], 
    notifications: [], 
    applications: [], 
    overview: {} 
  });
  const [twin, setTwin] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [dashRes, twinRes, deadRes] = await Promise.all([
          fetch('/api/dashboard/student', { headers }),
          fetch('/api/career/readiness-twin', { headers }),
          fetch('/api/dashboard/deadlines', { headers })
        ]);

        if (dashRes.ok && active) {
          const dashData = await dashRes.json();
          setData(dashData);
        }
        if (twinRes.ok && active) {
          const twinData = await twinRes.json();
          setTwin(twinData.twin);
        }
        if (deadRes.ok && active) {
          const deadData = await deadRes.json();
          setDeadlines(deadData.deadlines || []);
        }
      } catch (_) {
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, []);

  const statCards = [
    { label: 'Profile Completion', value: `${data.overview.profileCompletion || 0}%`, icon: UserRound, note: 'Target: 80%+' },
    { label: 'Eligible Requisitions', value: data.overview.eligibleJobs || 0, icon: Briefcase, note: 'Strict criteria met' },
    { label: 'Identified Skill Gaps', value: data.overview.skillGaps || 0, icon: Sparkles, note: 'Across target roles' },
    { label: 'Active Applications', value: data.overview.totalApplications || 0, icon: FileText, note: 'Submitted portfolios' }
  ];

  return (
    <Layout title="Student Placement Journey" role="student">
      {/* Top Banner / Placement Readiness Twin Snapshot */}
      <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-forest text-xs font-semibold">Module 5 AI Engine</span>
              <span className="text-xs text-muted-600 font-medium">Placement Readiness Twin Diagnosis</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal-900">
              Welcome back, {data.profile?.full_name || 'Candidate'}
            </h2>
            <p className="mt-2 text-sm text-charcoal-700 leading-relaxed font-normal">
              Your institutional twin continuously synthesizes academic metrics, verified skills, and interview practice to evaluate overall employability.
            </p>
          </div>

          {/* Aggregate Twin Score Badge */}
          <div className="flex items-center gap-6 p-4 rounded-xl bg-warm-50 border border-[#E5DFD3] self-start lg:self-center">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-600">Aggregate Readiness</div>
              <div className="text-3xl sm:text-4xl font-serif font-bold text-forest-900 mt-1">
                {twin ? twin.overall_score : 70}
                <span className="text-sm font-sans font-normal text-muted-500">/100</span>
              </div>
              <div className="text-[11px] text-forest-800 font-medium mt-0.5">
                Level: {twin ? twin.readiness_level : 'Evaluating'}
              </div>
            </div>
            <Link 
              to="/career" 
              className="btn btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-soft"
            >
              <Sliders className="w-3.5 h-3.5" /> Open Twin Simulator
            </Link>
          </div>
        </div>

        {/* 4 Dimension Breakdown */}
        {twin && (
          <div className="mt-6 pt-6 border-t border-[#ECE6D9] grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium text-charcoal-800">
                <span>Academic Fit</span>
                <span className="font-bold text-forest-900">{twin.dimensions.academic}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                <div className="h-full bg-forest-800" style={{ width: `${twin.dimensions.academic}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium text-charcoal-800">
                <span>Technical Skills</span>
                <span className="font-bold text-forest-900">{twin.dimensions.technical}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                <div className="h-full bg-forest-800" style={{ width: `${twin.dimensions.technical}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium text-charcoal-800">
                <span>Project Proof</span>
                <span className="font-bold text-forest-900">{twin.dimensions.experience}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                <div className="h-full bg-forest-800" style={{ width: `${twin.dimensions.experience}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium text-charcoal-800">
                <span>Interview Practice</span>
                <span className="font-bold text-forest-900">{twin.dimensions.practice}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                <div className="h-full bg-forest-800" style={{ width: `${twin.dimensions.practice}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, note }) => (
          <div key={label} className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-600 font-semibold">{label}</p>
                <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{value}</p>
                <p className="mt-1 text-[11px] text-muted-500">{note}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-sage-100/60 border border-sage-200 text-forest-900 flex items-center justify-center">
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature 7: Smart Placement Deadline Assistant */}
      {deadlines && deadlines.length > 0 && (
        <div className="mt-8 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-700" />
              <h3 className="font-serif text-lg font-bold text-charcoal-900">
                Smart Placement Deadline Assistant
              </h3>
            </div>
            <span className="badge badge-amber text-xs font-semibold">Priority Schedule</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deadlines.slice(0, 3).map((item, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border text-xs flex flex-col justify-between ${
                  item.priority === 'urgent' 
                    ? 'bg-ruby-50/60 border-ruby-200 text-ruby-900' 
                    : item.priority === 'warning'
                    ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                    : 'bg-warm-50 border-[#DFD9CC] text-charcoal-800'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className="font-bold capitalize">{item.priority}</span>
                  </div>
                  <h4 className="font-serif font-bold text-sm mb-1">{item.title}</h4>
                  <p className="opacity-90 leading-relaxed">{item.message}</p>
                </div>
                {item.link && (
                  <Link to={item.link} className="mt-3 font-semibold underline inline-flex items-center gap-1 hover:opacity-80">
                    Take action <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Middle Section: Recommended Jobs & Career Roadmap */}
      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        {/* Recommended Jobs */}
        <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft xl:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ECE6D9]">
            <div>
              <h3 className="text-lg font-serif font-bold text-charcoal-900">Recommended Opportunities</h3>
              <p className="text-xs text-muted-600">Calculated based on your verified skills, CGPA, and branch compliance.</p>
            </div>
            <Link to="/jobs" className="text-xs font-semibold text-forest-800 hover:text-forest-900 flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {(data.jobs || []).slice(0, 4).map((job) => (
              <div key={job.id} className="p-4 rounded-xl border border-[#DFD9CC] bg-warm-50/40 hover:border-forest-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-base text-charcoal-900">{job.title}</h4>
                      <span className="text-[11px] text-muted-500">#{job.id}</span>
                    </div>
                    <p className="text-xs text-muted-600 mt-0.5">{job.company_name} • {job.location || 'Remote/Hybrid'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge badge-sage text-xs font-semibold">
                      {job.match_score || 0}% Match
                    </span>
                    <Link to={`/jobs/${job.id}`} className="btn btn-secondary text-xs px-3 py-1.5">
                      Inspect
                    </Link>
                  </div>
                </div>

                {job.required_skills && job.required_skills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {job.required_skills.map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-white border border-[#DFD9CC] text-charcoal-700">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {(!data.jobs || data.jobs.length === 0) && (
              <div className="py-8 text-center text-sm text-muted-500">
                No recommended jobs currently matching your profile criteria. Update your profile skills to unlock recommendations.
              </div>
            )}
          </div>
        </div>

        {/* Personalized Career Roadmap */}
        <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ECE6D9]">
            <h3 className="text-lg font-serif font-bold text-charcoal-900">Career Roadmap</h3>
            <Link to="/career" className="text-xs font-semibold text-forest-800 hover:text-forest-900">
              Interactive View →
            </Link>
          </div>

          <div className="space-y-3">
            {(data.recommendations || []).slice(0, 3).map((r, i) => (
              <div key={r.id || i} className="p-4 rounded-xl bg-warm-50 border border-[#E5DFD3]">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">{r.title}</h4>
                  <Award size={16} className="text-forest-800 shrink-0 ml-2" />
                </div>
                <p className="text-xs text-charcoal-700 leading-relaxed">{r.reason}</p>
              </div>
            ))}

            {(!data.recommendations || data.recommendations.length === 0) && (
              <p className="text-xs text-muted-500 italic py-6 text-center">
                Career recommendations will generate once profile details and target roles are saved.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Notifications & Applications Tracker */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Notifications Digest */}
        <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ECE6D9]">
            <h3 className="text-lg font-serif font-bold text-charcoal-900">Recent Notifications</h3>
            <Link to="/notifications" className="text-xs font-semibold text-forest-800 hover:text-forest-900">
              Notification Center →
            </Link>
          </div>

          <div className="space-y-3">
            {(data.notifications || []).slice(0, 4).map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl border border-[#DFD9CC] bg-white text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-serif font-bold text-charcoal-900">{n.title}</span>
                  <span className="text-[10px] text-muted-500">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-charcoal-700">{n.message}</p>
              </div>
            ))}

            {(!data.notifications || data.notifications.length === 0) && (
              <p className="text-xs text-muted-500 py-6 text-center">No unread notifications.</p>
            )}
          </div>
        </div>

        {/* Application Timeline & Feedback Loop */}
        <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ECE6D9]">
            <h3 className="text-lg font-serif font-bold text-charcoal-900">Application Pipeline</h3>
            <span className="badge badge-sage text-xs">
              {data.overview.totalApplications || 0} Total
            </span>
          </div>

          {/* Pipeline counts */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 rounded-lg bg-warm-50 border border-[#E5DFD3]">
              <span className="text-[10px] uppercase font-bold text-muted-600 block">Applied</span>
              <span className="text-lg font-serif font-bold text-charcoal-900">{data.overview.applied || 0}</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-sage-50 border border-sage-200">
              <span className="text-[10px] uppercase font-bold text-forest-900 block">Shortlisted</span>
              <span className="text-lg font-serif font-bold text-forest-900">{data.overview.shortlisted || 0}</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-900 block">Interview</span>
              <span className="text-lg font-serif font-bold text-amber-900">{data.overview.interviews || 0}</span>
            </div>
          </div>

          <div className="space-y-3">
            {(data.applications || []).map((app) => (
              <div key={app.id} className="p-3.5 rounded-xl border border-[#DFD9CC] bg-white flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-serif font-bold text-charcoal-900">{app.job_title}</h4>
                  <p className="text-muted-600 mt-0.5">{app.company_name}</p>
                  {app.interview_date && (
                    <p className="text-[11px] text-amber-800 font-semibold mt-1">
                      📅 Scheduled: {new Date(app.interview_date).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-forest capitalize font-semibold">
                    {app.status}
                  </span>
                  <Link to={`/jobs/${app.job_id}`} className="text-forest-800 hover:text-forest-900 font-semibold">
                    Details →
                  </Link>
                </div>
              </div>
            ))}

            {(!data.applications || data.applications.length === 0) && (
              <p className="text-xs text-muted-500 py-6 text-center">
                You haven't submitted any applications yet. Explore the job catalog to get started.
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
