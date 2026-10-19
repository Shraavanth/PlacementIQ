import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  Search, 
  Filter, 
  GraduationCap, 
  Calendar, 
  ArrowRight,
  Briefcase
} from 'lucide-react';

export default function JobsPage() {
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const dashboard = { student: '/student', recruiter: '/recruiter', officer: '/officer', admin: '/admin' }[role];

  useEffect(() => {
    let active = true;
    fetch('/api/jobs')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load jobs.');
        if (active) setJobs(data.jobs || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load jobs.');
      });
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => {
    const set = new Set();
    jobs.forEach(j => { if (j.department) set.add(j.department); });
    return Array.from(set);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = 
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.required_skills?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDept = selectedDept === 'all' || job.department === selectedDept;

      return matchesSearch && matchesDept;
    });
  }, [jobs, searchTerm, selectedDept]);

  return (
    <div className="min-h-screen bg-ivory text-charcoal-900 pb-20">
      {/* Top Banner */}
      <div className="border-b border-[#E3DDCF] bg-white/70 py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-forest-800 font-bold">
              Institutional Requisitions
            </span>
            <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-charcoal-900">
              Campus Placements & Internships
            </h1>
            <p className="mt-2 text-sm sm:text-base text-muted-600 max-w-xl">
              Verified corporate hiring requisitions with explainable criteria and automated eligibility verification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {token ? (
              <Link to={dashboard || '/'} className="btn btn-secondary text-sm">
                Return to Dashboard
              </Link>
            ) : (
              <Link to="/auth" state={{ from: location }} className="btn btn-primary text-sm shadow-soft">
                Sign In to Apply
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-8">
        {/* Search & Filter Bar */}
        <div className="card p-4 bg-white border border-[#DFD9CC] shadow-soft mb-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-muted-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by job title, company, or technical skills (e.g. React, Python)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-with-icon-left text-sm w-full bg-warm-50/50 border-[#DFD9CC]"
              />
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-500" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="input text-sm w-full bg-warm-50/50 border-[#DFD9CC]"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-ruby-200 bg-ruby-50 px-4 py-3 text-sm text-ruby-800">
            {error}
          </p>
        )}

        {/* Requisitions List */}
        <div className="space-y-4">
          {!error && filteredJobs.length === 0 && (
            <div className="card p-12 text-center bg-white border border-[#DFD9CC]">
              <Briefcase className="w-10 h-10 text-muted-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-charcoal-900">No Requisitions Found</h3>
              <p className="mt-1 text-sm text-muted-600">
                {searchTerm || selectedDept !== 'all' 
                  ? 'No opportunities match your search filters. Try clearing or broadening your criteria.'
                  : 'There are no active placement drives published yet.'}
              </p>
            </div>
          )}

          {filteredJobs.map((job) => {
            const isDeadlinePassed = job.deadline && new Date(job.deadline) < new Date();
            return (
              <div 
                key={job.id} 
                className="card p-6 bg-white border border-[#DFD9CC] hover:border-forest-700 transition-all shadow-soft group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="badge badge-sage text-xs">Requisition #{job.id}</span>
                      {job.department && (
                        <span className="text-xs uppercase tracking-wider text-muted-500 font-semibold">
                          {job.department}
                        </span>
                      )}
                      {job.min_cgpa && (
                        <span className="text-xs text-charcoal-700 font-medium flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-forest-700" />
                          Min CGPA: {job.min_cgpa}
                        </span>
                      )}
                      {job.deadline && (
                        <span className={`text-xs font-medium flex items-center gap-1 ${isDeadlinePassed ? 'text-ruby-700' : 'text-amber-800'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {isDeadlinePassed ? 'Deadline Expired' : `Deadline: ${new Date(job.deadline).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-serif font-bold text-charcoal-900 group-hover:text-forest-900 transition-colors">
                      {job.title}
                    </h3>

                    <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted-600">
                      <span className="flex items-center gap-1 font-medium text-charcoal-800">
                        <Building2 className="w-3.5 h-3.5 text-forest-700" />
                        {job.company_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-400" />
                        {job.location || 'Remote / Hybrid'}
                      </span>
                    </div>

                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.required_skills.map((skill) => (
                          <span 
                            key={skill} 
                            className="text-[11px] px-2 py-0.5 rounded bg-warm-50 text-charcoal-800 border border-[#E5DFD3] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start md:self-center">
                    <Link 
                      to={`/jobs/${job.id}`} 
                      className="btn btn-secondary text-sm px-5 py-2.5 flex items-center gap-1.5 hover:bg-forest-900 hover:text-white transition-colors"
                    >
                      View Requisition <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
