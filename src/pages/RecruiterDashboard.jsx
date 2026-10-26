import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Briefcase, 
  Users, 
  CheckCircle2, 
  Calendar, 
  PlusCircle, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Clock,
  Filter,
  ArrowRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { useGlowHighlight } from '../utils/useGlowHighlight';

const blankJob = { 
  title: '', 
  description: '', 
  required_skills: '', 
  min_cgpa: '', 
  eligible_departments: '', 
  location: '', 
  work_mode: '',
  salary: '',
  openings: '1',
  graduation_year: '',
  graduation_year_mode: 'Only',
  deadline: '',
  status: 'Published'
};

export default function RecruiterDashboard() {
  const { triggerGlow } = useGlowHighlight();
  const [data, setData] = useState({ jobs: [], statistics: {} });
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(blankJob);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Recruiter feedback modal / form state
  const [selectedApp, setSelectedApp] = useState(null);
  const [newStatus, setNewStatus] = useState('Shortlisted');
  const [interviewDate, setInterviewDate] = useState('');
  const [feedbackStrengths, setFeedbackStrengths] = useState('');
  const [feedbackGaps, setFeedbackGaps] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const token = localStorage.getItem('token');

  const loadDashboard = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, appRes] = await Promise.all([
        fetch('/api/dashboard/recruiter', { headers }),
        fetch('/api/applications', { headers })
      ]);
      if (dashRes.ok) {
        const payload = await dashRes.json();
        setData(payload);
      }
      if (appRes.ok) {
        const appPayload = await appRes.json();
        setApplications(appPayload.applications || []);
      }
    } catch (err) {
      setError(err.message || 'Could not load recruiter data.');
    }
  };

  useEffect(() => {
    let active = true;
    if (token) loadDashboard();
    return () => { active = false; };
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const payload = {
      ...form,
      min_cgpa: form.min_cgpa === '' ? 0 : Number(form.min_cgpa),
      openings: Number(form.openings),
      graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
      graduation_year_mode: form.graduation_year_mode || 'Only',
      required_skills: form.required_skills.split(',').map((value) => value.trim()).filter(Boolean),
      eligible_departments: form.eligible_departments.split(',').map((value) => value.trim()).filter(Boolean)
    };
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create job.');
      await loadDashboard();
      setForm(blankJob);
      setMessage('Job posted successfully.');
    } catch (err) {
      setError(err.message || 'Could not create job.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Application Status & Recruiter Feedback Loop (Feature 6)
  const updateApplication = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    setSubmittingFeedback(true);
    try {
      const payload = {
        status: newStatus,
        interview_date: interviewDate ? new Date(interviewDate).toISOString() : null,
        feedback: {
          stage: newStatus,
          strengths: feedbackStrengths,
          gaps: feedbackGaps,
          recommendations: feedbackNotes
        }
      };
      const res = await fetch(`/api/applications/${selectedApp.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Could not update applicant status.');
      }
      await loadDashboard();
      setSelectedApp(null);
      setFeedbackStrengths('');
      setFeedbackGaps('');
      setFeedbackNotes('');
      setInterviewDate('');
      setMessage('Candidate status and feedback updated successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const statistics = data.statistics || {};

  return (
    <Layout title="Recruiter Governance & Hiring Suite" role="recruiter">
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Module 3 & 7</span>
              <span className="text-xs text-muted-600 font-medium">Recruitment Lifecycle & Feedback Loop</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Corporate Requisitions & Candidate Pipeline
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Publish structured job requirements, evaluate applicant academic compliance, 
              schedule interviews, and provide actionable feedback directly linked to candidates' improvement roadmaps.
            </p>
          </div>
        </div>
      </div>

      <section aria-label="Recruiter capabilities" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link 
          to="/recruiter/jobs#requisitions" 
          id="nav-manage-requisitions"
          className="card card-hover p-4 bg-white border border-[#DFD9CC] block text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <Briefcase className="w-5 h-5 text-forest-800" />
            <ArrowRight className="w-4 h-4 text-muted-400" />
          </div>
          <h3 className="font-serif font-bold text-charcoal-900">Manage requisitions</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Set role details, required skills, eligibility rules, openings, and application deadlines.</p>
        </Link>
        <a 
          href="#applicant-review" 
          id="nav-review-applicants"
          onClick={(e) => { e.preventDefault(); window.location.hash = 'applicant-review'; triggerGlow('applicant-review'); }}
          className="card card-hover p-4 bg-white border border-[#DFD9CC] block text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-forest-800" />
            <ArrowRight className="w-4 h-4 text-muted-400" />
          </div>
          <h3 className="font-serif font-bold text-charcoal-900">Review applicants</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">See candidate profiles, academic details, verified departments, and skills for your jobs.</p>
        </a>
        <a 
          href="#candidate-pipeline" 
          id="nav-move-candidates"
          onClick={(e) => { e.preventDefault(); window.location.hash = 'candidate-pipeline'; triggerGlow('candidate-pipeline'); }}
          className="card card-hover p-4 bg-white border border-[#DFD9CC] block text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-forest-800" />
            <ArrowRight className="w-4 h-4 text-muted-400" />
          </div>
          <h3 className="font-serif font-bold text-charcoal-900">Move candidates forward</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Update application stages and schedule interviews from the applicant pipeline.</p>
        </a>
        <a 
          href="#candidate-feedback" 
          id="nav-share-feedback"
          onClick={(e) => { e.preventDefault(); window.location.hash = 'candidate-feedback'; triggerGlow('candidate-feedback'); }}
          className="card card-hover p-4 bg-white border border-[#DFD9CC] block text-left cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="w-5 h-5 text-forest-800" />
            <ArrowRight className="w-4 h-4 text-muted-400" />
          </div>
          <h3 className="font-serif font-bold text-charcoal-900">Share useful feedback</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-600">Record strengths, skill gaps, and next steps candidates can use to improve.</p>
        </a>
      </section>

      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-ruby-50 border border-ruby-200 p-4 text-xs text-ruby-800">
          {error}
        </p>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Published Requisitions</p>
              <p className="mt-2 text-3xl font-serif font-bold text-charcoal-900">{statistics.published_jobs || data.jobs?.length || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Total Applicants</p>
              <p className="mt-2 text-3xl font-serif font-bold text-charcoal-900">{applications.length || statistics.applications || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-5 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-600 font-bold">Awaiting Review</p>
              <p className="mt-2 text-3xl font-serif font-bold text-charcoal-900">{statistics.awaiting_review || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sage-100 text-forest-900 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8 card p-5 bg-white border border-[#DFD9CC] shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif font-bold text-lg text-charcoal-900">Manage your requisitions</h3>
          <p className="mt-1 text-xs text-muted-600">Create, edit, publish, close, or archive postings in Job Posting.</p>
        </div>
        <Link to="/recruiter/jobs" className="btn btn-primary text-xs px-5 py-2.5">
          Open Job Posting
        </Link>
      </section>

      <div className="mt-8 grid gap-8">
        {false && (
        <div className="lg:col-span-6">
          <form id="requisition-form" className="card p-6 bg-white border border-[#DFD9CC] shadow-soft space-y-4" onSubmit={submit}>
            <div className="flex items-center gap-2 pb-3 border-b border-[#ECE6D9]">
              <PlusCircle className="w-5 h-5 text-forest-800" />
              <h3 className="text-lg font-serif font-bold text-charcoal-900">Requisition Details</h3>
            </div>

            <div>
              <label className="form-label text-xs">Job Title *</label>
              <input 
                className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                placeholder="e.g. Graduate Software Engineer" 
                required 
                value={form.title} 
                onChange={(event) => setForm({ ...form, title: event.target.value })} 
              />
            </div>

            <div>
              <label className="form-label text-xs">Job Description *</label>
              <textarea 
                className="input text-xs w-full min-h-24 bg-warm-50/60 border-[#DFD9CC]" 
                placeholder="Detail core responsibilities, team structure, and qualifications..." 
                required 
                value={form.description} 
                onChange={(event) => setForm({ ...form, description: event.target.value })} 
              />
            </div>

            <div>
              <label className="form-label text-xs">Required Technical Skills (comma-separated)</label>
              <input 
                className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                placeholder="e.g. React, Python, PostgreSQL, REST" 
                value={form.required_skills} 
                onChange={(event) => setForm({ ...form, required_skills: event.target.value })} 
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label text-xs">Minimum CGPA Cutoff</label>
                <input 
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                  type="number" 
                  min="0" 
                  max="10" 
                  step="0.01" 
                  placeholder="e.g. 7.5" 
                  value={form.min_cgpa} 
                  onChange={(event) => setForm({ ...form, min_cgpa: event.target.value })} 
                />
              </div>

              <div>
                <label className="form-label text-xs">Target Departments</label>
                <input 
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                  placeholder="e.g. CSE, IT, ECE" 
                  value={form.eligible_departments} 
                  onChange={(event) => setForm({ ...form, eligible_departments: event.target.value })} 
                />
              </div>

              <div>
                <label className="form-label text-xs">Job Location</label>
                <input 
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                  placeholder="e.g. Bengaluru / Hybrid" 
                  value={form.location} 
                  onChange={(event) => setForm({ ...form, location: event.target.value })} 
                />
              </div>

              <div>
                <label className="form-label text-xs">Work Mode</label>
                <select
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]"
                  value={form.work_mode}
                  onChange={(event) => setForm({ ...form, work_mode: event.target.value })}
                >
                  <option value="">Select work mode</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Salary / Stipend</label>
                <input
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]"
                  placeholder="e.g. ₹10-14 LPA"
                  value={form.salary}
                  onChange={(event) => setForm({ ...form, salary: event.target.value })}
                />
              </div>

              <div>
                <label className="form-label text-xs">Number of Openings</label>
                <input
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]"
                  type="number"
                  min="1"
                  required
                  value={form.openings}
                  onChange={(event) => setForm({ ...form, openings: event.target.value })}
                />
              </div>

              <div>
                <label className="form-label text-xs">Posting Status</label>
                <select
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="Published">Publish now</option>
                  <option value="Draft">Save as draft</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Graduation Year (Optional)</label>
                <input 
                  className="input text-xs w-full bg-warm-50/60 border-[#DFD9CC]" 
                  type="number" 
                  min="1900" 
                  max="2200" 
                  placeholder="e.g. 2026" 
                  value={form.graduation_year} 
                  onChange={(event) => setForm({ ...form, graduation_year: event.target.value })} 
                />
              </div>
            </div>

            {message && <p role="status" className="text-xs font-semibold text-forest-800 bg-sage-50 border border-sage-200 p-2 rounded">{message}</p>}

            <button 
              type="submit" 
              className="btn btn-primary text-xs px-6 py-2.5 w-full shadow-soft" 
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Post Requisition'}
            </button>
          </form>
        </div>
        )}

        {/* Requisitions List */}
        <div className="space-y-4">
          <section className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
            <div className="flex items-center justify-between pb-3 border-b border-[#ECE6D9] mb-4">
              <h3 className="text-lg font-serif font-bold text-charcoal-900">Your Active Postings</h3>
              <span className="badge badge-sage text-xs">{statistics.published_jobs || 0} Published</span>
            </div>

            <div className="space-y-3">
              {data.jobs.map((job) => (
                <div key={job.id} className="p-4 rounded-xl border border-[#DFD9CC] bg-warm-50/40 text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-serif font-bold text-sm text-charcoal-900">{job.title}</h4>
                      <p className="text-muted-600">{job.company_name} • {job.location || 'Remote/Hybrid'} • Min CGPA: {job.min_cgpa || 'None'} • {job.openings} openings</p>
                    </div>
                    <span className="badge badge-forest capitalize font-semibold">{job.status}</span>
                  </div>
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.required_skills.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded bg-white border border-[#DFD9CC] text-[10px] text-charcoal-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {job.deadline && (
                    <p className="mt-2 text-[10px] text-muted-600">Application deadline: {new Date(job.deadline).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
              {!data.jobs.length && (
                <p className="text-xs text-muted-500 italic py-6 text-center">
                  You have not published any job requisitions yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Destination B: Review applicants */}
      <section id="applicant-review" className="mt-10 card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ECE6D9] mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-forest-800" />
              <h3 className="text-xl font-serif font-bold text-charcoal-900">
                Review Applicants & Profiles
              </h3>
            </div>
            <p className="text-xs text-muted-600">
              Evaluate applicant academic compliance, confirmed departments, graduation years, and technical skills.
            </p>
          </div>
          <span className="badge badge-sage text-xs">
            {applications.length} Candidates
          </span>
        </div>

        <div className="space-y-3">
          {applications.map((app) => (
            <div 
              key={`review-${app.id}`} 
              className="p-4 rounded-xl border border-[#DFD9CC] bg-warm-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-serif font-bold text-sm text-charcoal-900">{app.student_name}</span>
                  <span className="text-muted-500">({app.student_email})</span>
                  <span className="badge badge-forest capitalize">{app.status}</span>
                </div>
                <p className="text-muted-700">
                  Applied for: <strong>{app.job_title}</strong>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-600">
                  <span className="bg-white px-2 py-1 rounded border border-[#DFD9CC]">
                    🎓 Academic Dept: <strong>{app.department || 'Not specified'}</strong>
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-[#DFD9CC]">
                    📅 Grad Year: <strong>{app.graduation_year || 'Not specified'}</strong>
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-[#DFD9CC]">
                    📊 CGPA: <strong>{app.cgpa ?? 'Not specified'}</strong>
                  </span>
                </div>
                {app.skills && app.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-sage-50 text-forest-900 border border-sage-200 text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {app.cover_note && (
                  <p className="mt-2 italic text-muted-600 bg-white p-2 rounded border border-[#DFD9CC]">
                    "{app.cover_note}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setSelectedApp(app); setNewStatus(app.status); }}
                  className="btn btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Evaluate Candidate
                </button>
              </div>
            </div>
          ))}

          {applications.length === 0 && (
            <p className="text-xs text-muted-500 italic py-8 text-center">
              No student applications submitted to your requisitions yet.
            </p>
          )}
        </div>
      </section>

      {/* Destination C: Move candidates forward */}
      <section id="candidate-pipeline" className="mt-8 card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ECE6D9] mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-forest-800" />
              <h3 className="text-xl font-serif font-bold text-charcoal-900">
                Move Candidates Forward — Application Pipeline
              </h3>
            </div>
            <p className="text-xs text-muted-600">
              Update application stages, schedule interviews, and guide candidate progression through hiring milestones.
            </p>
          </div>
          <span className="badge badge-sage text-xs">
            {applications.filter(a => ['Shortlisted', 'Interview', 'Hired'].includes(a.status)).length} Active Pipeline
          </span>
        </div>

        <div className="space-y-3">
          {applications.map((app) => (
            <div 
              key={`pipeline-${app.id}`} 
              className="p-4 rounded-xl border border-[#DFD9CC] bg-white hover:border-forest-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-serif font-bold text-sm text-charcoal-900">{app.student_name}</span>
                  <span className="badge badge-forest capitalize">{app.status}</span>
                </div>
                <p className="text-muted-600">
                  Role: <strong>{app.job_title}</strong> • Dept: {app.department || 'N/A'} • CGPA: {app.cgpa || 'N/A'}
                </p>
                {app.interview_date ? (
                  <p className="text-amber-800 font-semibold mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Interview Scheduled: {new Date(app.interview_date).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-muted-400 mt-1 italic">
                    No interview scheduled yet
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { 
                    setSelectedApp(app); 
                    setNewStatus(app.status === 'Applied' ? 'Shortlisted' : app.status === 'Shortlisted' ? 'Interview' : app.status); 
                  }}
                  className="btn btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule Interview / Advance Stage
                </button>
              </div>
            </div>
          ))}

          {applications.length === 0 && (
            <p className="text-xs text-muted-500 italic py-8 text-center">
              No candidates currently in the pipeline.
            </p>
          )}
        </div>
      </section>

      {/* Destination D: Share useful feedback */}
      <section id="candidate-feedback" className="mt-8 card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ECE6D9] mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 text-forest-800" />
              <h3 className="text-xl font-serif font-bold text-charcoal-900">
                Share Useful Feedback & Candidate Guidance
              </h3>
            </div>
            <p className="text-xs text-muted-600">
              Record candidate strengths, identified competency gaps, and actionable recommendations to guide student career development.
            </p>
          </div>
          <span className="badge badge-sage text-xs">
            Feedback & Growth Loop
          </span>
        </div>

        <div className="space-y-4">
          {applications.map((app) => {
            const hasFeedbacks = app.feedbacks && app.feedbacks.length > 0;
            return (
              <div 
                key={`feedback-${app.id}`} 
                className="p-4 rounded-xl border border-[#DFD9CC] bg-warm-50/40 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-sm text-charcoal-900">{app.student_name}</span>
                      <span className="text-muted-500">({app.student_email})</span>
                      <span className="badge badge-forest capitalize">{app.status}</span>
                    </div>
                    <p className="text-muted-600 mt-0.5">Application for: <strong>{app.job_title}</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedApp(app); setNewStatus(app.status); }}
                    className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {hasFeedbacks ? 'Add More Feedback' : 'Record Constructive Feedback'}
                  </button>
                </div>

                {hasFeedbacks ? (
                  <div className="mt-3 space-y-2 border-t border-[#ECE6D9] pt-2">
                    {app.feedbacks.map((fb, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-[#DFD9CC] space-y-1">
                        <div className="flex justify-between items-center text-[11px] text-muted-500">
                          <span className="font-semibold text-charcoal-800">Stage: {fb.stage || app.status}</span>
                          {fb.created_at && <span>{new Date(fb.created_at).toLocaleDateString()}</span>}
                        </div>
                        {fb.strengths && (
                          <p className="text-forest-800"><strong>Strengths:</strong> {fb.strengths}</p>
                        )}
                        {fb.gaps && (
                          <p className="text-amber-800"><strong>Skill Gaps:</strong> {fb.gaps}</p>
                        )}
                        {fb.recommendations && (
                          <p className="text-charcoal-700"><strong>Recommendations:</strong> {fb.recommendations}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-muted-500 italic">
                    No structured feedback recorded yet for this candidate. Click "Record Constructive Feedback" to help guide their preparation.
                  </p>
                )}
              </div>
            );
          })}

          {applications.length === 0 && (
            <p className="text-xs text-muted-500 italic py-8 text-center">
              No candidates available to provide feedback.
            </p>
          )}
        </div>
      </section>

      {/* Structured Feedback Modal / Form */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 bg-white border border-[#DFD9CC] shadow-card max-w-lg w-full">
            <div className="flex justify-between items-center pb-3 border-b border-[#ECE6D9] mb-4">
              <h4 className="font-serif font-bold text-base text-charcoal-900">
                Update Status for {selectedApp.student_name}
              </h4>
              <button 
                type="button" 
                onClick={() => setSelectedApp(null)}
                className="text-muted-400 hover:text-charcoal-900 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={updateApplication} className="space-y-3 text-xs">
              <div>
                <label className="form-label text-xs">Application Stage / Decision</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input text-xs w-full bg-warm-50"
                >
                  <option value="Applied">Applied</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview">Interview Scheduled</option>
                  <option value="Hired">Hired / Offer Extended</option>
                  <option value="Rejected">Rejected (With Advisory)</option>
                </select>
              </div>

              {newStatus === 'Interview' && (
                <div>
                  <label className="form-label text-xs">Schedule Interview Date & Time</label>
                  <input
                    type="datetime-local"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="input text-xs w-full bg-warm-50"
                    required
                  />
                </div>
              )}

              <div>
                <label className="form-label text-xs">Candidate Strengths Noted</label>
                <input
                  type="text"
                  placeholder="e.g. Strong foundational algorithms, clear communication"
                  value={feedbackStrengths}
                  onChange={(e) => setFeedbackStrengths(e.target.value)}
                  className="input text-xs w-full bg-warm-50"
                />
              </div>

              <div>
                <label className="form-label text-xs">Identified Competency Gaps</label>
                <input
                  type="text"
                  placeholder="e.g. Needs deeper system design exposure or distributed cache practice"
                  value={feedbackGaps}
                  onChange={(e) => setFeedbackGaps(e.target.value)}
                  className="input text-xs w-full bg-warm-50"
                />
              </div>

              <div>
                <label className="form-label text-xs">Actionable Recommendations for Student</label>
                <textarea
                  rows={3}
                  placeholder="Advise on specific projects, certificates, or topics to practice..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  className="input text-xs w-full bg-warm-50"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#ECE6D9]">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="btn btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="btn btn-primary text-xs px-5 py-2 shadow-soft"
                >
                  {submittingFeedback ? 'Saving...' : 'Save & Notify Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
