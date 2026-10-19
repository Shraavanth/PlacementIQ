import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Building2, 
  MapPin, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';

export default function JobDetailsPage() {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [existingApplication, setExistingApplication] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  const loadEligibilityAndApp = async (active = true) => {
    if (!token || role !== 'student') return;
    try {
      const eligibilityResponse = await fetch(`/api/jobs/${jobId}/eligibility`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const eligibilityData = await eligibilityResponse.json();
      if (eligibilityResponse.ok && active) {
        setEligibility(eligibilityData.eligibility);
        if (eligibilityData.application) {
          setExistingApplication(eligibilityData.application);
          // fetch feedback if available
          try {
            const fbRes = await fetch(`/api/applications/${eligibilityData.application.id}/feedback`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (active && fbData.feedback && fbData.feedback.length > 0) {
                setFeedback(fbData.feedback);
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load this job.');
        if (active) setJob(data.job);
        if (active) await loadEligibilityAndApp(active);
      } catch (err) {
        if (active) setError(err.message || 'Could not load this job.');
      }
    };
    load();
    return () => { active = false; };
  }, [jobId, role, token]);

  const apply = async () => {
    if (!token) {
      navigate('/auth', { state: { from: location } });
      return;
    }
    if (role !== 'student') {
      setMessage('Only student accounts can apply for jobs.');
      return;
    }
    if (existingApplication) {
      setMessage(`You have already applied for this role. Current status: ${existingApplication.status}.`);
      return;
    }
    setApplying(true);
    setMessage('');
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: Number(jobId) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit your application.');
      setMessage(data.message || 'Application submitted successfully.');
      setExistingApplication({ id: data.application_id, status: 'applied' });
      // Refresh eligibility and application state
      loadEligibilityAndApp(true);
    } catch (err) {
      setMessage(err.message || 'Could not submit your application.');
    } finally {
      setApplying(false);
    }
  };

  const isApplied = Boolean(existingApplication);
  const isEligible = eligibility?.eligible !== false;
  const isDeadlinePassed = job?.deadline && new Date(job.deadline) < new Date();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to job catalog
        </Link>
      </div>

      <div className="card p-6 sm:p-10 bg-white border border-[#DFD9CC] shadow-soft">
        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-ruby-200 bg-ruby-50 px-4 py-3 text-sm text-ruby-800">
            {error}
          </p>
        )}

        {job && (
          <>
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#ECE6D9]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-sage">Requisition #{job.id}</span>
                  {job.department && (
                    <span className="text-xs uppercase tracking-wider text-muted-500 font-semibold">
                      {job.department}
                    </span>
                  )}
                  {isApplied && (
                    <span className="badge badge-forest capitalize font-semibold">
                      Applied ({existingApplication.status})
                    </span>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-charcoal-900 tracking-tight">
                  {job.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-600">
                  <span className="flex items-center gap-1.5 font-medium text-charcoal-800">
                    <Building2 className="w-4 h-4 text-forest-700" />
                    {job.company_name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-muted-400" />
                    {job.location || 'Remote / Hybrid'}
                  </span>
                  {job.deadline && (
                    <span className={`flex items-center gap-1.5 font-medium ${isDeadlinePassed ? 'text-ruby-700' : 'text-amber-700'}`}>
                      <Calendar className="w-4 h-4" />
                      Deadline: {new Date(job.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {isDeadlinePassed && ' (Expired)'}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick action card */}
              <div className="flex flex-col sm:items-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-primary px-8 py-3 text-base shadow-soft disabled:opacity-60"
                  onClick={apply}
                  disabled={applying || isApplied || (Boolean(token) && role === 'student' && !isEligible) || isDeadlinePassed}
                >
                  {applying ? 'Submitting...' : isApplied ? `Application ${existingApplication.status}` : 'Apply now'}
                </button>
                {message && (
                  <p role="status" className="text-sm font-medium text-forest-800 bg-sage-50 border border-sage-200 px-3 py-1.5 rounded-md">
                    {message}
                  </p>
                )}
                {existingApplication?.interview_date && (
                  <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-lg font-medium">
                    📅 Interview scheduled: {new Date(existingApplication.interview_date).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Role Overview */}
            <div className="mt-8">
              <h2 className="text-lg font-serif font-bold text-charcoal-900 mb-3">Role Description</h2>
              <div className="prose prose-stone text-charcoal-700 leading-relaxed whitespace-pre-line text-sm sm:text-base font-sans">
                {job.description}
              </div>
            </div>

            {/* Feature 2: Explainable Job Matching & Eligibility Breakdown */}
            <div className="mt-10 pt-8 border-t border-[#ECE6D9]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-forest-700" />
                  <h3 className="font-serif text-xl font-bold text-charcoal-900">
                    Explainable Eligibility & Skill Diagnosis
                  </h3>
                </div>
                {eligibility && (
                  <span className={`badge ${eligibility.eligible ? 'badge-forest' : 'badge-amber'}`}>
                    {eligibility.eligible ? 'All Mandatory Criteria Met' : 'Action Required for Eligibility'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mandatory Requirements */}
                <div className="p-5 rounded-xl bg-warm-50 border border-[#E5DFD3]">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-forest-900 mb-3">
                    Mandatory Qualifications
                  </h4>
                  <ul className="space-y-2 text-sm text-charcoal-800">
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-muted-500" />
                        Minimum CGPA: {job.min_cgpa ?? 'None required'}
                      </span>
                      {eligibility?.mandatory_breakdown && (
                        eligibility.mandatory_breakdown.cgpa_met 
                          ? <span className="flex items-center gap-1 text-xs text-forest-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> Met</span>
                          : <span className="flex items-center gap-1 text-xs text-ruby-600 font-semibold"><XCircle className="w-4 h-4" /> Below cutoff</span>
                      )}
                    </li>

                    {job.department && (
                      <li className="flex items-center justify-between">
                        <span>Target Department: {job.department}</span>
                        {eligibility?.mandatory_breakdown && (
                          eligibility.mandatory_breakdown.department_met 
                            ? <span className="flex items-center gap-1 text-xs text-forest-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> Met</span>
                            : <span className="flex items-center gap-1 text-xs text-ruby-600 font-semibold"><XCircle className="w-4 h-4" /> Different branch</span>
                        )}
                      </li>
                    )}

                    {job.grad_year && (
                      <li className="flex items-center justify-between">
                        <span>Graduation Year: {job.grad_year}</span>
                        {eligibility?.mandatory_breakdown && (
                          eligibility.mandatory_breakdown.grad_year_met 
                            ? <span className="flex items-center gap-1 text-xs text-forest-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> Met</span>
                            : <span className="flex items-center gap-1 text-xs text-ruby-600 font-semibold"><XCircle className="w-4 h-4" /> Year mismatch</span>
                        )}
                      </li>
                    )}
                  </ul>

                  {/* Overall reasons */}
                  {eligibility && (
                    <div className="mt-4 pt-3 border-t border-[#DFD9CC]">
                      <p className={`text-xs sm:text-sm font-medium ${eligibility.eligible ? 'text-forest-800' : 'text-ruby-700'}`}>
                        {eligibility.eligible ? '✓ You satisfy all strict institutional placement requirements.' : eligibility.reasons?.join(' ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Skills Analysis */}
                <div className="p-5 rounded-xl bg-warm-50 border border-[#E5DFD3]">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-forest-900 mb-3">
                    Technical & Domain Competencies
                  </h4>

                  <div className="mb-4">
                    <p className="text-xs text-muted-600 font-semibold uppercase mb-1.5">Required Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.required_skills && job.required_skills.length > 0 ? (
                        job.required_skills.map((s) => {
                          const isMatched = eligibility?.matched_skills?.includes(s);
                          return (
                            <span 
                              key={s} 
                              className={`text-xs px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 ${
                                isMatched 
                                  ? 'bg-sage-100 text-forest-900 border border-sage-300' 
                                  : 'bg-white text-charcoal-700 border border-[#DFD9CC]'
                              }`}
                            >
                              {isMatched && <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" />}
                              {s}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-500">None specified</span>
                      )}
                    </div>
                  </div>

                  {/* Missing Skills and Recommendations */}
                  {eligibility?.missing_skills && eligibility.missing_skills.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-900 flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Skills to acquire for optimal fit:
                      </p>
                      <p className="text-xs text-amber-800">
                        {eligibility.missing_skills.join(', ')}
                      </p>
                    </div>
                  )}

                  {eligibility?.score_basis && (
                    <p className="mt-3 text-[11px] text-muted-500 italic">
                      Matching computation: {eligibility.score_basis}
                    </p>
                  )}
                </div>
              </div>

              {/* Actionable Steps for Candidate */}
              {eligibility?.actionable_steps && eligibility.actionable_steps.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-sage-50/60 border border-sage-200">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-forest-900 mb-2">
                    Actionable Improvement Recommendations
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-xs text-charcoal-800">
                    {eligibility.actionable_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Feature 6: Recruiter Feedback Display if present */}
            {feedback && feedback.length > 0 && (
              <div className="mt-8 p-5 rounded-xl bg-warm-100 border border-[#D5CDBD]">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-5 h-5 text-forest-800" />
                  <h4 className="font-serif text-lg font-bold text-charcoal-900">
                    Recruiter Review & Advisory Notes
                  </h4>
                </div>
                <div className="space-y-3">
                  {feedback.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-[#DFD9CC] text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="badge badge-forest text-xs font-semibold capitalize">
                          Stage: {item.stage}
                        </span>
                        <span className="text-xs text-muted-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {item.strengths && (
                        <p className="text-xs text-forest-900 mb-1">
                          <strong>Strengths noted:</strong> {item.strengths}
                        </p>
                      )}
                      {item.gaps && (
                        <p className="text-xs text-amber-900 mb-1">
                          <strong>Improvement areas:</strong> {item.gaps}
                        </p>
                      )}
                      {item.recommendations && (
                        <p className="text-xs text-charcoal-700 italic">
                          "{item.recommendations}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-10 pt-6 border-t border-[#ECE6D9] flex flex-wrap items-center justify-between gap-4">
              <Link to="/jobs" className="btn btn-secondary text-sm">
                ← Explore More Opportunities
              </Link>
              {role === 'student' && (
                <Link to="/career" className="text-sm font-medium text-forest-800 hover:text-forest-900 underline">
                  Run Placement Readiness Twin simulation for this role →
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
