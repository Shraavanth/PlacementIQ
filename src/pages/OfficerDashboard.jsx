import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Briefcase, 
  TrendingUp, 
  GraduationCap, 
  BarChart3, 
  PieChart, 
  Layers, 
  Sparkles,
  Info
} from 'lucide-react';
import Layout from '../components/Layout';

export default function OfficerDashboard() {
  const [data, setData] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [offRes, intelRes, jobsRes] = await Promise.all([
          fetch('/api/dashboard/officer', { headers }),
          fetch('/api/dashboard/intelligence', { headers }),
          fetch('/api/jobs')
        ]);

        if (offRes.ok && active) {
          const offData = await offRes.json();
          setData(offData);
        }
        if (intelRes.ok && active) {
          const intelData = await intelRes.json();
          setIntelligence(intelData);
        }
        if (jobsRes.ok && active) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData.jobs || []);
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load placement intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  const statistics = data?.statistics || {};
  const funnelItems = intelligence?.funnel || [];
  const funnelCount = (stage) => funnelItems.find((item) => item.stage === stage)?.count || 0;
  const totalApplications = funnelCount('Total Applications');
  const shortlisted = funnelCount('Shortlisted');
  const interviews = funnelCount('Interview Round');
  const hired = funnelCount('Final Placement / Offer');
  const funnel = {
    total_applications: totalApplications,
    shortlisted,
    interview: interviews,
    hired,
    app_to_shortlist_pct: totalApplications ? Math.round((shortlisted / totalApplications) * 100) : 0,
    shortlist_to_offer_pct: shortlisted + interviews + hired
      ? Math.round((hired / (shortlisted + interviews + hired)) * 100)
      : 0
  };
  const publishedJobs = jobs.filter((job) => job.status === 'Published');

  return (
    <Layout title="Placement Officer Analytics" role="officer">
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Module 8</span>
              <span className="text-xs text-muted-600 font-medium">Placement Intelligence & Institutional Forecasting</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Campus Placement Operations & Analytics
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Real-time departmental metrics, conversion funnel diagnostics, skill-demand forecasting, 
              and corporate recruitment drive oversight.
            </p>
          </div>

          {intelligence?.sample_mode && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Demonstration Baseline Mode</span>
            </div>
          )}
        </div>
      </div>

      <section aria-label="Placement officer capabilities" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <a href="#department-progress" className="card card-hover p-4 bg-white border border-[#DFD9CC]">
          <h3 className="font-serif font-bold text-charcoal-900">Monitor student outcomes</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Review placement rates and compare progress across academic departments.</p>
        </a>
        <a href="#skill-demand" className="card card-hover p-4 bg-white border border-[#DFD9CC]">
          <h3 className="font-serif font-bold text-charcoal-900">Plan for skill demand</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Use published role requirements to spot frequently requested skills.</p>
        </a>
        <a href="#placement-funnel" className="card card-hover p-4 bg-white border border-[#DFD9CC]">
          <h3 className="font-serif font-bold text-charcoal-900">Track the hiring funnel</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">See applications, shortlists, interviews, and offers in one view.</p>
        </a>
        <a href="#campus-opportunities" className="card card-hover p-4 bg-white border border-[#DFD9CC]">
          <h3 className="font-serif font-bold text-charcoal-900">Oversee campus opportunities</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Browse published company roles and review eligibility requirements.</p>
        </a>
      </section>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-ruby-50 border border-ruby-200 p-4 text-xs text-ruby-800">
          {error}
        </p>
      )}

      {/* Primary KPI Cards */}
      <div className="grid gap-5 md:grid-cols-4">
        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Registered Students</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{statistics.students ?? '—'}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Corporate Partners</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{statistics.companies ?? '—'}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">All Requisitions</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-charcoal-900">{statistics.jobs ?? '—'}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Campus Placement Rate</p>
              <p className="mt-1.5 text-3xl font-serif font-bold text-forest-900">{statistics.placement_rate ?? '—'}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Feature 5: Placement Intelligence & Skill-Demand Forecasting */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Skill-Demand Trends */}
        <div id="skill-demand" className="lg:col-span-7 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECE6D9] mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-forest-800" />
              <h3 className="font-serif font-bold text-lg text-charcoal-900">
                Most Frequently Requested Skills
              </h3>
            </div>
            <span className="badge badge-sage text-xs">Requisition Demand</span>
          </div>

          <p className="text-xs text-muted-600 mb-6">
            Aggregate frequency of technical competencies specified across active corporate job requisitions.
          </p>

          <div className="space-y-3">
            {intelligence?.frequent_skills?.map((item) => {
              const maxCount = Math.max(...(intelligence.frequent_skills.map(s => s.count)), 1);
              const widthPct = Math.round((item.count / maxCount) * 100);

              return (
                <div key={item.skill} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-charcoal-800">
                    <span>{item.skill}</span>
                    <span className="text-forest-900">{item.count} Requisitions</span>
                  </div>
                  <div className="h-2 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-forest-800 rounded-full transition-all duration-500" 
                      style={{ width: `${widthPct}%` }} 
                    />
                  </div>
                </div>
              );
            })}

            {(!intelligence?.frequent_skills || intelligence.frequent_skills.length === 0) && (
              <p className="text-xs text-muted-500 italic py-6 text-center">
                Insufficient requisition data to compute skill frequency.
              </p>
            )}
          </div>
        </div>

        {/* Application-to-Offer Conversion Funnel */}
        <div id="placement-funnel" className="lg:col-span-5 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECE6D9] mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-forest-800" />
              <h3 className="font-serif font-bold text-lg text-charcoal-900">
                Placement Conversion Funnel
              </h3>
            </div>
            <span className="badge badge-forest text-xs">Stage Rates</span>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-warm-50 border border-[#E5DFD3] flex justify-between items-center text-xs">
              <div>
                <span className="text-muted-500 block uppercase tracking-wider text-[10px] font-bold">1. Total Applications</span>
                <span className="font-serif font-bold text-lg text-charcoal-900">{funnel.total_applications || 0}</span>
              </div>
              <span className="badge bg-white border border-[#DFD9CC] text-charcoal-800">Top of Funnel</span>
            </div>

            <div className="p-3.5 rounded-xl bg-sage-50/70 border border-sage-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-muted-500 block uppercase tracking-wider text-[10px] font-bold">2. Shortlisted Candidates</span>
                <span className="font-serif font-bold text-lg text-forest-900">{funnel.shortlisted || 0}</span>
              </div>
              <span className="badge badge-sage font-bold">
                {funnel.app_to_shortlist_pct || 0}% Conv.
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-muted-500 block uppercase tracking-wider text-[10px] font-bold">3. Interviews Scheduled</span>
                <span className="font-serif font-bold text-lg text-amber-900">{funnel.interview || 0}</span>
              </div>
              <span className="badge badge-amber font-bold">Screening</span>
            </div>

            <div className="p-3.5 rounded-xl bg-forest-900 text-ivory flex justify-between items-center text-xs">
              <div>
                <span className="text-sage-200 block uppercase tracking-wider text-[10px] font-bold">4. Final Offers / Placed</span>
                <span className="font-serif font-bold text-lg text-white">{funnel.hired || 0}</span>
              </div>
              <span className="badge bg-[#295A45] text-white border-0 font-bold">
                {funnel.shortlist_to_offer_pct || 0}% Offer Rate
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown & Drives */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Department Statistics */}
        <div id="department-progress" className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <h3 className="font-serif font-bold text-lg text-charcoal-900 mb-4 pb-3 border-b border-[#ECE6D9]">
            Departmental Placement Progress
          </h3>
          <div className="space-y-3">
            {(intelligence?.department_trends || []).map((dept) => {
              const rate = dept.placement_rate || 0;
              return (
                <div key={dept.department} className="p-3.5 rounded-xl border border-[#DFD9CC] bg-white flex justify-between items-center text-xs">
                  <div>
                    <h4 className="font-serif font-bold text-sm text-charcoal-900">{dept.department}</h4>
                    <p className="text-muted-500">{dept.placed_students} Placed out of {dept.total_students} Students</p>
                  </div>
                  <span className="badge badge-forest text-xs font-semibold">{rate}% Placed</span>
                </div>
              );
            })}

            {(!intelligence?.department_trends || intelligence.department_trends.length === 0) && (
              <p className="text-xs text-muted-500 italic py-6 text-center">No departmental records found.</p>
            )}
          </div>
        </div>

        {/* Published campus opportunities */}
        <div id="campus-opportunities" className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#ECE6D9]">
            <h3 className="font-serif font-bold text-lg text-charcoal-900">Published Campus Opportunities</h3>
            <Link to="/jobs" className="text-xs font-semibold text-forest-800 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {publishedJobs.slice(0, 5).map((job) => (
              <Link to={`/jobs/${job.id}`} key={job.id} className="block p-3.5 rounded-xl border border-[#DFD9CC] bg-warm-50/50 hover:border-forest-700 transition-colors text-xs">
                <div>
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">{job.title}</h4>
                  <p className="text-muted-500">{job.company_name} · {job.location || 'Location flexible'}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(job.required_skills || []).slice(0, 5).map((skill) => (
                    <span key={skill} className="rounded bg-white border border-[#DFD9CC] px-2 py-0.5 text-[10px] text-charcoal-700">{skill}</span>
                  ))}
                </div>
              </Link>
            ))}

            {publishedJobs.length === 0 && (
              <p className="text-xs text-muted-500 italic py-6 text-center">No scheduled recruitment drives.</p>
            )}
          </div>

          {data?.summary && (
            <div className="mt-6 pt-4 border-t border-[#ECE6D9] text-xs text-charcoal-700 leading-relaxed font-sans">
              <strong>Institutional Note:</strong> {data.summary}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
