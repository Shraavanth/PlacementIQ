import { useEffect, useState } from 'react';
import { 
  FileCheck2, 
  Upload, 
  Github, 
  Award, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import Layout from '../components/Layout';

export default function ResumePage() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  // Feature 3: Evidence-Based Skill Verification states
  const [evidenceList, setEvidenceList] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [evidenceType, setEvidenceType] = useState('github');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [evidenceMsg, setEvidenceMsg] = useState('');

  // Interactive Quiz state
  const [quizSkill, setQuizSkill] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    let active = true;
    fetch('/api/resume/analysis', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your latest resume analysis.');
        if (active) setAnalysis(data.analysis);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load your latest resume analysis.');
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    fetch('/api/jobs')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load jobs for skill-gap analysis.');
        if (active) setJobs(data.jobs || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load jobs for skill-gap analysis.');
      });
    return () => { active = false; };
  }, []);

  // Fetch skill evidence
  const loadEvidence = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/student/skills/evidence', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data.evidence || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadEvidence();
  }, [token]);

  const loadSkillGaps = async () => {
    if (!jobId) {
      setError('Choose a job to see its skill gaps.');
      return;
    }
    setError('');
    try {
      const response = await fetch(`/api/resume/analysis?job_id=${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load skill gaps.');
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message || 'Could not load skill gaps.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF resume before analyzing it.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The resume must be 5 MB or smaller.');
      return;
    }
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not analyze this resume.');
      setAnalysis(data.resume.analysis);
    } catch (err) {
      setError(err.message || 'Could not analyze this resume.');
    } finally {
      setLoading(false);
    }
  };

  // Submit GitHub / Project Evidence
  const submitSkillEvidence = async (e) => {
    e.preventDefault();
    if (!skillInput || !evidenceUrl) return;
    setSubmittingEvidence(true);
    setEvidenceMsg('');
    try {
      const res = await fetch('/api/student/skills/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          skill_name: skillInput,
          evidence_type: evidenceType,
          evidence_url: evidenceUrl,
          notes: evidenceNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save evidence.');
      setEvidenceMsg('Evidence successfully linked to skill portfolio.');
      setSkillInput('');
      setEvidenceUrl('');
      setEvidenceNotes('');
      loadEvidence();
    } catch (err) {
      setEvidenceMsg(err.message);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // Start Skill Quiz
  const startQuiz = async (skillName) => {
    setQuizSkill(skillName);
    setQuizAnswers({});
    setQuizResult(null);
    try {
      const res = await fetch(`/api/student/skills/quiz/${encodeURIComponent(skillName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuizData(data);
      }
    } catch (_) {}
  };

  // Submit Quiz Answers
  const submitQuiz = async (e) => {
    e.preventDefault();
    if (!quizData) return;
    setSubmittingQuiz(true);
    try {
      const formattedAnswers = Object.entries(quizAnswers).map(([qIdx, optIdx]) => ({
        question_index: Number(qIdx),
        selected_option: Number(optIdx)
      }));

      const res = await fetch('/api/student/skills/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          skill_name: quizSkill,
          answers: formattedAnswers
        })
      });
      const data = await res.json();
      if (res.ok) {
        setQuizResult(data);
        loadEvidence();
      }
    } catch (_) {
    } finally {
      setSubmittingQuiz(false);
    }
  };

  return (
    <Layout title="Resume Analysis & Skill Verification" role="student">
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Module 6</span>
              <span className="text-xs text-muted-600 font-medium">Explainable Resume & Verification Suite</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Resume Intelligence & 4-Tier Skill Verification
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Upload your PDF resume for automated parsing, conduct side-by-side gap analysis with requisitions, 
              and elevate self-reported skills to verified status with quizzes and project repositories.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-sage text-xs">
              {evidenceList.length} Verified Evidence Records
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upload Card */}
        <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#ECE6D9]">
            <Upload className="w-5 h-5 text-forest-800" />
            <h3 className="text-lg font-serif font-bold text-charcoal-900">Upload PDF Resume</h3>
          </div>

          <form onSubmit={submit}>
            <p className="text-xs text-muted-600 mb-3">
              Upload your latest curriculum vitae (Max 5MB, PDF only). Our parser extracts skills, education, and credentials deterministically.
            </p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Resume PDF"
              className="block w-full rounded-xl border border-dashed border-[#DFD9CC] bg-warm-50/70 p-6 text-xs text-charcoal-700 cursor-pointer hover:bg-warm-100 transition-colors"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button 
              type="submit" 
              className="btn btn-primary mt-6 text-xs px-6 py-2.5 shadow-soft" 
              disabled={loading}
            >
              {loading ? 'Analyzing resume...' : 'Analyze resume'}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-ruby-50 border border-ruby-200 p-3 text-xs text-ruby-800">
              {error}
            </p>
          )}
        </div>

        {/* Detected Skills & Gap Analysis Card */}
        <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#ECE6D9]">
            <Sparkles className="w-5 h-5 text-forest-800" />
            <h3 className="text-lg font-serif font-bold text-charcoal-900">Extracted Skills & Requisition Comparison</h3>
          </div>

          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-600 font-bold mb-2">Detected Skills</h4>
            {analysis?.skills?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.skills.map((skill) => (
                  <span 
                    key={skill} 
                    className="badge badge-sage text-xs font-medium cursor-pointer hover:bg-sage-200"
                    title="Click to take validation quiz"
                    onClick={() => startQuiz(skill)}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-500 italic">
                {analysis?.notes || 'Upload a PDF resume to see extracted skills.'}
              </p>
            )}
          </div>

          {analysis?.education?.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-warm-50 border border-[#E5DFD3] text-xs">
              <span className="font-bold text-forest-900 uppercase tracking-wider text-[10px] block mb-1">
                Education Credentials Detected
              </span>
              <p className="text-charcoal-800">{analysis.education.join(', ')}</p>
            </div>
          )}

          {analysis?.notes && analysis.skills?.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-500 italic">{analysis.notes}</p>
          )}

          {/* Job comparison selector */}
          <div className="mt-6 pt-5 border-t border-[#ECE6D9]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-serif font-bold text-charcoal-900 shrink-0" htmlFor="skill-gap-job">
                Compare with job
              </label>
              <select 
                id="skill-gap-job" 
                className="input text-xs flex-1 bg-warm-50 border-[#DFD9CC]" 
                value={jobId} 
                onChange={(event) => setJobId(event.target.value)}
              >
                <option value="">Select a job requisition</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    #{job.id} — {job.title} ({job.company_name})
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                className="btn btn-secondary text-xs px-4 py-2 shrink-0" 
                onClick={loadSkillGaps}
              >
                Show skill gaps
              </button>
            </div>

            {analysis?.missing_skills?.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50/90 border border-amber-200 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Skills to build for this job
                </h4>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {analysis.missing_skills.map((skill) => (
                    <span key={skill} className="badge badge-amber text-xs font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>
                {analysis.skill_gap_guidance?.map((step) => (
                  <p key={step} className="mt-2 text-xs text-amber-900 font-medium">
                    {step}
                  </p>
                ))}
              </div>
            )}

            {analysis?.missing_skills?.length === 0 && analysis?.job_id && (
              <p className="mt-4 text-xs font-semibold text-forest-800 bg-sage-50 border border-sage-200 p-3 rounded-lg">
                ✓ No required skills are missing for the selected job. Excellent fit!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feature 3: Evidence-Based Skill Verification Suite */}
      <div className="mt-10 card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ECE6D9]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-forest-800" />
              <h3 className="text-xl font-serif font-bold text-charcoal-900">
                Evidence-Based Skill Verification
              </h3>
            </div>
            <p className="text-xs text-muted-600">
              Distinguish your skills across four recognized tiers: Self-Reported, Skill-Quiz Assessed, Project-Evidenced, and Officially Verified.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="badge badge-sage">Tier 1: Self-Reported</span>
            <span className="badge badge-forest">Tier 2: Quiz-Assessed</span>
            <span className="badge bg-forest-900 text-white">Tier 3: Project Evidence</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Submit Repository / Project Link */}
          <div className="lg:col-span-5 p-5 rounded-xl bg-warm-50/60 border border-[#E5DFD3]">
            <h4 className="font-serif font-bold text-sm text-charcoal-900 mb-2">
              Submit Project or GitHub Proof
            </h4>
            <p className="text-xs text-muted-600 mb-4">
              Link a public GitHub repository, live demonstration URL, or certification artifact to verify your competency.
            </p>

            <form onSubmit={submitSkillEvidence} className="space-y-3">
              <div>
                <label className="form-label text-xs">Skill Name</label>
                <input
                  type="text"
                  placeholder="e.g. React, Python, Docker"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  className="input text-xs w-full bg-white border-[#DFD9CC]"
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">Evidence Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="input text-xs w-full bg-white border-[#DFD9CC]"
                >
                  <option value="github">GitHub Repository</option>
                  <option value="project_demo">Live Project Demo / URL</option>
                  <option value="certification">Official Certificate</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Artifact URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="input text-xs w-full bg-white border-[#DFD9CC]"
                  required
                />
              </div>

              <div>
                <label className="form-label text-xs">Implementation Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Describe your architecture, libraries used, or key modules..."
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="input text-xs w-full bg-white border-[#DFD9CC]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingEvidence}
                className="btn btn-primary text-xs px-5 py-2.5 w-full flex items-center justify-center gap-1.5 shadow-soft"
              >
                <ShieldCheck className="w-4 h-4" />
                {submittingEvidence ? 'Registering Evidence...' : 'Register Skill Evidence'}
              </button>

              {evidenceMsg && (
                <p className="text-xs font-semibold text-forest-800 bg-sage-50 border border-sage-200 p-2 rounded text-center">
                  {evidenceMsg}
                </p>
              )}
            </form>
          </div>

          {/* Existing Verified Skills & Interactive Quiz */}
          <div className="lg:col-span-7 space-y-6">
            {/* Quick validation quiz launcher */}
            <div className="p-4 rounded-xl bg-sage-50/70 border border-sage-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif font-bold text-sm text-forest-900">
                  Take Skill-Specific Verification Quiz
                </span>
                <span className="badge badge-forest text-[10px]">Tier 2 Assessment</span>
              </div>
              <p className="text-xs text-charcoal-700 mb-3">
                Select any skill from your detected list or enter a skill to take an interactive 3-question evaluation.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter skill (e.g. Python, React, SQL)..."
                  value={quizSkill}
                  onChange={(e) => setQuizSkill(e.target.value)}
                  className="input text-xs flex-1 bg-white border-[#DFD9CC]"
                />
                <button
                  type="button"
                  onClick={() => startQuiz(quizSkill)}
                  disabled={!quizSkill.trim()}
                  className="btn btn-secondary text-xs px-4 py-2 shrink-0"
                >
                  Start Quiz
                </button>
              </div>

              {/* Active Quiz Card */}
              {quizData && (
                <form onSubmit={submitQuiz} className="mt-4 pt-4 border-t border-sage-200 space-y-4">
                  <h5 className="font-serif font-bold text-xs uppercase tracking-wider text-forest-900">
                    {quizData.skill} Evaluation Quiz ({quizData.questions?.length} Questions)
                  </h5>

                  {quizData.questions?.map((q, qIdx) => (
                    <div key={qIdx} className="bg-white p-3 rounded-lg border border-sage-200 text-xs">
                      <p className="font-semibold text-charcoal-900 mb-2">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="space-y-1.5 pl-2">
                        {q.options?.map((opt, optIdx) => (
                          <label key={optIdx} className="flex items-center gap-2 cursor-pointer text-charcoal-700">
                            <input
                              type="radio"
                              name={`question-${qIdx}`}
                              checked={quizAnswers[qIdx] === optIdx}
                              onChange={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                              required
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={submittingQuiz}
                    className="btn btn-primary text-xs px-5 py-2 shadow-soft"
                  >
                    {submittingQuiz ? 'Grading...' : 'Submit Answers for Verification'}
                  </button>

                  {quizResult && (
                    <div className="mt-3 p-3 rounded-lg bg-white border border-forest-300 text-xs">
                      <p className="font-bold text-forest-900">
                        Quiz Completed! Score: {quizResult.score}% ({quizResult.correct_count}/{quizResult.total_questions})
                      </p>
                      <p className="text-muted-600 mt-0.5">{quizResult.notes}</p>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* List of Verified Evidences */}
            <div>
              <h4 className="font-serif font-bold text-sm text-charcoal-900 mb-3 uppercase tracking-wider">
                Current Verified Skill Portfolio ({evidenceList.length})
              </h4>

              <div className="space-y-2">
                {evidenceList.map((ev) => (
                  <div 
                    key={ev.id} 
                    className="p-3.5 rounded-xl border border-[#DFD9CC] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-sm text-charcoal-900">{ev.skill_name}</span>
                        <span className="badge badge-forest text-[10px] capitalize">Tier {ev.tier}: {ev.evidence_type}</span>
                        {ev.score && (
                          <span className="text-[10px] font-semibold text-forest-800">
                            Score: {ev.score}%
                          </span>
                        )}
                      </div>
                      <p className="text-muted-500 mt-0.5 truncate max-w-md">{ev.verification_notes}</p>
                    </div>

                    {ev.evidence_url && (
                      <a 
                        href={ev.evidence_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-semibold text-forest-800 hover:text-forest-900 flex items-center gap-1 shrink-0"
                      >
                        Inspect Artifact <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}

                {evidenceList.length === 0 && (
                  <p className="text-xs text-muted-500 italic py-4 text-center">
                    No verified skill evidence submitted yet. Link a GitHub repository or complete a quiz to elevate your skill tiers.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
