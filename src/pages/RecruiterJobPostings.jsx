import { useEffect, useState } from 'react';
import { Briefcase, PlusCircle, Save } from 'lucide-react';
import Layout from '../components/Layout';
import { useGlowHighlight } from '../utils/useGlowHighlight';

const blankJob = {
  company_name: '',
  title: '',
  description: '',
  required_skills: '',
  eligible_departments: '',
  min_cgpa: '',
  graduation_year: '',
  graduation_year_mode: 'Only',
  location: '',
  work_mode: '',
  salary: '',
  openings: '1',
  deadline: '',
  status: 'Published'
};

const listValue = (value) => (value || []).join(', ');

export default function RecruiterJobPostings() {
  useGlowHighlight();
  const [jobs, setJobs] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [form, setForm] = useState(blankJob);
  const [editingJobId, setEditingJobId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem('token');

  const loadJobs = async () => {
    const response = await fetch('/api/dashboard/recruiter', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load your job postings.');
    setJobs(data.jobs || []);
    setStatistics(data.statistics || {});
  };

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/recruiter', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your job postings.');
        if (active) {
          setJobs(data.jobs || []);
          setStatistics(data.statistics || {});
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load your job postings.');
      });
    return () => { active = false; };
  }, [token]);

  const resetForm = () => {
    setForm(blankJob);
    setEditingJobId(null);
  };

  const editJob = (job) => {
    setEditingJobId(job.id);
    setForm({
      company_name: job.company_name || '',
      title: job.title || '',
      description: job.description || '',
      required_skills: listValue(job.required_skills),
      eligible_departments: listValue(job.eligible_departments),
      min_cgpa: job.min_cgpa ?? '',
      graduation_year: job.graduation_year ?? '',
      graduation_year_mode: job.graduation_year_mode || 'Only',
      location: job.location || '',
      work_mode: job.work_mode || '',
      salary: job.salary || '',
      openings: String(job.openings || 1),
      deadline: job.deadline ? job.deadline.slice(0, 10) : '',
      status: job.status || 'Draft'
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveJob = async (event) => {
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
      const response = await fetch(editingJobId ? `/api/jobs/${editingJobId}` : '/api/jobs', {
        method: editingJobId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save the job requisition.');
      await loadJobs();
      resetForm();
      setMessage(editingJobId ? 'Requisition updated.' : 'Requisition saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not save the job requisition.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (job, status) => {
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update requisition status.');
      await loadJobs();
      setMessage(`${job.title} is now ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err.message || 'Could not update requisition status.');
    }
  };

  return (
    <Layout title="Recruiter Job Posting" role="recruiter">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="badge badge-forest text-xs">Recruiter · Job Posting</span>
          <h1 className="mt-2 text-3xl font-serif font-bold text-charcoal-900">Job requisitions</h1>
          <p className="mt-1 text-sm text-muted-600">Manage roles, eligibility, deadlines, and publication status.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge badge-sage">{statistics.published_jobs || 0} published</span>
          <span className="badge badge-sage">{statistics.applications || 0} applicants</span>
          <span className="badge badge-sage">{statistics.awaiting_review || 0} awaiting review</span>
        </div>
      </div>

      {error && <p role="alert" className="mb-5 rounded-lg bg-ruby-50 border border-ruby-200 p-3 text-sm text-ruby-800">{error}</p>}
      {message && <p role="status" className="mb-5 rounded-lg bg-sage-50 border border-sage-200 p-3 text-sm text-forest-800">{message}</p>}

      <div id="requisitions" className="grid gap-8 xl:grid-cols-5">
        <form onSubmit={saveJob} className="xl:col-span-2 card p-6 bg-white border border-[#DFD9CC] shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-[#ECE6D9] pb-3">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-forest-800" />
              <h2 className="font-serif text-lg font-bold text-charcoal-900">{editingJobId ? 'Edit requisition' : 'Publish new requisition'}</h2>
            </div>
            {editingJobId && <button type="button" className="text-xs text-forest-800 underline" onClick={resetForm}>Cancel edit</button>}
          </div>

          <p className="text-xs text-muted-600">The hiring organization is associated with your recruiter account. The application supports existing job eligibility fields.</p>
          <label className="block form-label">Company or hiring organization
            <input className="input mt-1" value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} placeholder="Required for your first requisition" />
          </label>
          <label className="block form-label">Job title *
            <input className="input mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label className="block form-label">Description *
            <textarea className="input mt-1 min-h-28" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
          </label>
          <label className="block form-label">Required skills
            <input className="input mt-1" value={form.required_skills} onChange={(event) => setForm({ ...form, required_skills: event.target.value })} placeholder="Python, SQL, React" />
          </label>
          <label className="block form-label">Eligible departments
            <input className="input mt-1" value={form.eligible_departments} onChange={(event) => setForm({ ...form, eligible_departments: event.target.value })} placeholder="CSE, IT, ECE" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block form-label">Minimum CGPA
              <input className="input mt-1" type="number" min="0" max="10" step="0.01" value={form.min_cgpa} onChange={(event) => setForm({ ...form, min_cgpa: event.target.value })} />
            </label>
            <label className="block form-label">Graduation year
              <input className="input mt-1" type="number" min="1900" max="2200" value={form.graduation_year} onChange={(event) => setForm({ ...form, graduation_year: event.target.value })} placeholder="e.g. 2026" />
            </label>
            <label className="block form-label">Graduation Year Eligibility Mode
              <select className="input mt-1" value={form.graduation_year_mode} onChange={(event) => setForm({ ...form, graduation_year_mode: event.target.value })}>
                <option value="Only">Only</option>
                <option value="NA">NA</option>
              </select>
            </label>
            <label className="block form-label">Location
              <input className="input mt-1" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </label>
            <label className="block form-label">Work mode
              <select className="input mt-1" value={form.work_mode} onChange={(event) => setForm({ ...form, work_mode: event.target.value })}>
                <option value="">Select</option><option>On-site</option><option>Hybrid</option><option>Remote</option>
              </select>
            </label>
            <label className="block form-label">Salary / stipend
              <input className="input mt-1" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} />
            </label>
            <label className="block form-label">Openings
              <input className="input mt-1" type="number" min="1" value={form.openings} onChange={(event) => setForm({ ...form, openings: event.target.value })} required />
            </label>
            <label className="block form-label">Application deadline
              <input className="input mt-1" type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
            </label>
            <label className="block form-label">Status
              <select className="input mt-1" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="Draft">Draft</option><option value="Published">Published</option>
                {editingJobId && <><option value="Closed">Closed</option><option value="Archived">Archived</option></>}
              </select>
            </label>
          </div>
          <button className="btn btn-primary w-full text-sm" type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />{loading ? 'Saving...' : editingJobId ? 'Save changes' : 'Publish requisition'}
          </button>
        </form>

        <section className="xl:col-span-3 card p-6 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="mb-4 flex items-center gap-2 border-b border-[#ECE6D9] pb-3">
            <Briefcase className="h-5 w-5 text-forest-800" />
            <h2 className="font-serif text-lg font-bold text-charcoal-900">Your postings</h2>
          </div>
          <div className="space-y-3">
            {jobs.map((job) => (
              <article key={job.id} className="rounded-xl border border-[#DFD9CC] bg-warm-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif font-bold text-charcoal-900">{job.title}</h3>
                    <p className="mt-1 text-xs text-muted-600">{job.company_name} · {job.location || 'Location flexible'} · {job.openings} openings</p>
                    <p className="mt-1 text-xs text-muted-600">
                      {job.application_count || 0} applications · {job.min_cgpa ? `CGPA ${job.min_cgpa}+` : 'No CGPA cutoff'}
                      {job.graduation_year ? ` · Grad Year: ${job.graduation_year} (${job.graduation_year_mode || 'Only'})` : ''}
                      {job.deadline ? ` · Deadline ${new Date(job.deadline).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className="badge badge-forest">{job.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => editJob(job)}>Edit</button>
                  {job.status === 'Published' && <button type="button" className="btn btn-secondary text-xs" onClick={() => updateStatus(job, 'Closed')}>Close</button>}
                  {job.status === 'Draft' && <button type="button" className="btn btn-secondary text-xs" onClick={() => updateStatus(job, 'Published')}>Publish</button>}
                  {job.status !== 'Archived' && <button type="button" className="btn btn-secondary text-xs" onClick={() => updateStatus(job, 'Archived')}>Archive</button>}
                </div>
              </article>
            ))}
            {!jobs.length && <p className="py-8 text-center text-sm italic text-muted-600">No requisitions yet. Create your first posting here.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
