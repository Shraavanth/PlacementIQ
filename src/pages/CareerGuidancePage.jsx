import { useEffect, useState } from 'react';
import { 
  Activity, 
  Sliders, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  MessageSquare, 
  Award, 
  Send, 
  History, 
  TrendingUp, 
  BookOpen, 
  Compass,
  AlertCircle
} from 'lucide-react';
import Layout from '../components/Layout';

export default function CareerGuidancePage() {
  const [activeTab, setActiveTab] = useState('twin'); // 'twin' | 'interview' | 'paths'
  const [recommendations, setRecommendations] = useState([]);
  const [twin, setTwin] = useState(null);
  const [roadmapTasks, setRoadmapTasks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // What-if simulator state
  const [simulatedSkills, setSimulatedSkills] = useState('');
  const [simulatedProject, setSimulatedProject] = useState(false);
  const [simulatedPractice, setSimulatedPractice] = useState(false);
  const [simulatedCgpa, setSimulatedCgpa] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Interview state
  const [targetRole, setTargetRole] = useState('Fullstack Engineer');
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [submittingInterview, setSubmittingInterview] = useState(false);
  const [interviewResult, setInterviewResult] = useState(null);
  const [interviewHistory, setInterviewHistory] = useState([]);

  const token = localStorage.getItem('token');

  // Load baseline guidance & twin & roadmap
  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      if (!token) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [guideRes, twinRes, tasksRes] = await Promise.all([
          fetch('/api/career/guidance', { headers }),
          fetch('/api/career/readiness-twin', { headers }),
          fetch('/api/career/roadmap-tasks', { headers })
        ]);

        const failedResponse = [guideRes, twinRes, tasksRes].find((response) => !response.ok);
        if (failedResponse) {
          const failure = await failedResponse.json();
          throw new Error(failure.error || 'Could not load career intelligence.');
        }
        const [gData, tData, taskData] = await Promise.all([
          guideRes.json(), twinRes.json(), tasksRes.json()
        ]);
        if (active) {
          setRecommendations(gData.recommendations || []);
          setTwin(tData);
          setRoadmapTasks(taskData.tasks || []);
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load career intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAll();
    return () => { active = false; };
  }, [token]);

  // Load interview questions & history when interview tab is opened
  useEffect(() => {
    if (activeTab !== 'interview' || !token) return;
    let active = true;
    const fetchInterviewData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [qRes, hRes] = await Promise.all([
          fetch(`/api/career/interview/questions?role=${encodeURIComponent(targetRole)}`, { headers }),
          fetch('/api/career/interview/history', { headers })
        ]);
        if (!qRes.ok || !hRes.ok) {
          const failedResponse = !qRes.ok ? qRes : hRes;
          const failure = await failedResponse.json();
          throw new Error(failure.error || 'Could not load interview practice data.');
        }
        const [qData, hData] = await Promise.all([qRes.json(), hRes.json()]);
        if (active) {
          setQuestions(qData.questions || []);
          if (qData.questions?.length > 0 && !selectedQuestion) {
            setSelectedQuestion(qData.questions[0]);
          }
          setInterviewHistory(hData.history || []);
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load interview practice data.');
      }
    };
    fetchInterviewData();
    return () => { active = false; };
  }, [activeTab, targetRole, token]);

  // Run What-If Simulation
  const runSimulation = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setError('');
    try {
      const skillsArray = simulatedSkills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/career/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          added_skills: skillsArray,
          has_project: simulatedProject,
          has_interview_practice: simulatedPractice,
          simulated_cgpa: simulatedCgpa ? Number(simulatedCgpa) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not run the readiness simulation.');
      setSimulationResult(data);
    } catch (err) {
      setError(err.message || 'Could not run the readiness simulation.');
    } finally {
      setSimulating(false);
    }
  };

  // Toggle Roadmap Task
  const toggleTask = async (taskId) => {
    try {
      const res = await fetch(`/api/career/roadmap-tasks/${taskId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update roadmap progress.');
      setRoadmapTasks((previous) => previous.map((task) => task.id === taskId ? data.task : task));
    } catch (err) {
      setError(err.message || 'Could not update roadmap progress.');
    }
  };

  // Submit Mock Interview Answer
  const submitAnswer = async (e) => {
    e.preventDefault();
    if (!selectedQuestion || !answerText.trim()) return;
    setSubmittingInterview(true);
    setError('');
    try {
      const res = await fetch('/api/career/interview/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role_target: targetRole,
          category: selectedQuestion.category,
          question: selectedQuestion.question,
          answer: answerText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the interview attempt.');
      if (res.ok) {
        setInterviewResult(data.attempt);
        // refresh history
        const hRes = await fetch('/api/career/interview/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (hRes.ok) {
          const hData = await hRes.json();
          setInterviewHistory(hData.history || []);
        }
      }
    } catch (err) {
      setError(err.message || 'Could not submit the interview answer.');
    } finally {
      setSubmittingInterview(false);
    }
  };

  return (
    <Layout title="AI Career Guidance & Placement Twin" role="student">
      {error && (
        <p role="alert" className="mb-6 rounded-lg bg-ruby-50 border border-ruby-200 p-4 text-sm text-ruby-800">
          {error}
        </p>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#DFD9CC] mb-8 space-x-8 text-sm font-serif">
        <button
          onClick={() => setActiveTab('twin')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'twin'
              ? 'border-forest-900 text-forest-900 text-base'
              : 'border-transparent text-muted-500 hover:text-charcoal-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Placement Readiness Twin & Roadmap
        </button>

        <button
          onClick={() => setActiveTab('interview')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'interview'
              ? 'border-forest-900 text-forest-900 text-base'
              : 'border-transparent text-muted-500 hover:text-charcoal-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Adaptive Interview Practice
        </button>

        <button
          onClick={() => setActiveTab('paths')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'paths'
              ? 'border-forest-900 text-forest-900 text-base'
              : 'border-transparent text-muted-500 hover:text-charcoal-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          Career Pathways & Recommendations
        </button>
      </div>

      {loading ? (
        <p role="status" className="text-muted-600 font-serif italic py-10">
          Synthesizing student portfolio metrics and career models...
        </p>
      ) : (
        <>
          {/* TAB 1: PLACEMENT READINESS TWIN & WHAT-IF SIMULATOR */}
          {activeTab === 'twin' && (
            <div className="space-y-8">
              {/* Twin Scorecard */}
              {twin && (
                <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#ECE6D9]">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-forest text-xs">Module 5 Dynamic Model</span>
                        <span className="text-xs text-muted-500">Documented 4-Dimension Metric</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-serif font-bold text-charcoal-900">
                        Placement Readiness Twin Status
                      </h2>
                      <p className="mt-1 text-xs text-muted-600">
                        {twin.summary} {twin.methodology}
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-4 bg-warm-50 p-4 rounded-xl border border-[#DFD9CC]">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-600 font-bold">Overall Score</div>
                        <div className="text-3xl sm:text-4xl font-serif font-bold text-forest-900">
                          {twin.composite_score}<span className="text-sm font-sans font-normal text-muted-500">/100</span>
                        </div>
                      </div>
                      <span className="badge badge-sage font-semibold capitalize text-xs">
                        {twin.readiness_level}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {twin.dimensions.map((dimension) => (
                      <div key={dimension.name} className="p-4 rounded-lg bg-warm-50/70 border border-[#E5DFD3]">
                        <div className="flex justify-between gap-2 text-xs uppercase tracking-wider text-muted-600 font-semibold mb-1">
                          <span>{dimension.name}</span><span>{dimension.weight}</span>
                        </div>
                        <div className="text-2xl font-serif font-bold text-forest-900">{dimension.score}%</div>
                        <ul className="mt-2 space-y-1 text-[11px] text-muted-600">
                          {dimension.factors.map((factor) => <li key={factor}>{factor}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {twin.missing_profile_fields?.length > 0 && (
                    <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                      Complete these profile fields for a more complete assessment: {twin.missing_profile_fields.map((field) => field.replaceAll('_', ' ')).join(', ')}.
                    </p>
                  )}

                  <div className="mt-6">
                    <h3 className="font-serif font-bold text-sm text-charcoal-900 mb-3">Published-job eligibility and skill match</h3>
                    <div className="space-y-2">
                      {twin.job_analyses.map((job) => (
                        <div key={job.job_id} className="rounded-lg border border-[#DFD9CC] bg-white p-3 text-xs">
                          <div className="flex flex-wrap justify-between gap-2">
                            <strong>{job.title} · {job.company_name}</strong>
                            <span className={job.eligible ? 'font-semibold text-forest-800' : job.eligibility_status === 'profile_required' ? 'font-semibold text-amber-800' : 'font-semibold text-ruby-700'}>
                              {job.eligible ? 'Eligible to apply' : job.eligibility_status === 'profile_required' ? 'Profile information required' : 'Not eligible'} · {job.skill_match_percentage}% skills match
                            </span>
                          </div>
                          {!job.eligible && <p className="mt-1 text-muted-600">Mandatory eligibility: {job.eligibility_reasons.join(' ')}</p>}
                          {job.missing_skills?.length > 0 && <p className="mt-1 text-muted-600">Skill gaps to develop: {job.missing_skills.join(', ')}. These do not block applications.</p>}
                          {job.missing_skills.length > 0 && <p className="mt-1 text-amber-800">Skill gaps: {job.missing_skills.join(', ')}</p>}
                        </div>
                      ))}
                      {twin.job_analyses.length === 0 && <p className="text-xs text-muted-600">No published job requirements are currently available to compare.</p>}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    {Object.entries(twin.application_outcomes || {}).map(([status, count]) => (
                      <span key={status} className="badge badge-sage">{status}: {count}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* What-If Simulator */}
              <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
                <div className="flex items-center gap-2 mb-2">
                  <Sliders className="w-5 h-5 text-forest-800" />
                  <h3 className="text-xl font-serif font-bold text-charcoal-900">
                    What-If Readiness Simulator
                  </h3>
                </div>
                <p className="text-xs text-muted-600 max-w-2xl mb-6">
                  Explore hypothetical career improvements without modifying your verified academic record. 
                  Simulate the quantitative impact of adding new technical skills, publishing a project, or boosting CGPA.
                </p>

                <form onSubmit={runSimulation} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="form-label text-xs">Simulate Adding Skills (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Docker, TypeScript, AWS"
                      value={simulatedSkills}
                      onChange={(e) => setSimulatedSkills(e.target.value)}
                      className="input text-xs w-full bg-warm-50"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs">Simulate CGPA Adjustment</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      placeholder="e.g. 8.5"
                      value={simulatedCgpa}
                      onChange={(e) => setSimulatedCgpa(e.target.value)}
                      className="input text-xs w-full bg-warm-50"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-charcoal-800 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={simulatedProject}
                        onChange={(e) => setSimulatedProject(e.target.checked)}
                        className="rounded border-[#DFD9CC] text-forest-800 focus:ring-forest-700"
                      />
                      Add Project / Repo
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-charcoal-800 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={simulatedPractice}
                        onChange={(e) => setSimulatedPractice(e.target.checked)}
                        className="rounded border-[#DFD9CC] text-forest-800 focus:ring-forest-700"
                      />
                      Add interview practice
                    </label>

                    <button
                      type="submit"
                      disabled={simulating}
                      className="btn btn-primary text-xs px-5 py-2.5 mb-1.5 flex items-center gap-1.5 shadow-soft ml-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {simulating ? 'Simulating...' : 'Run Simulation'}
                    </button>
                  </div>
                </form>

                {/* Simulation Result Display */}
                {simulationResult && (
                  <div className="mt-6 p-5 rounded-xl bg-sage-50 border border-sage-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-sage-200">
                      <div>
                        <span className="badge badge-forest text-[11px] mb-1 font-semibold">
                          {simulationResult.disclaimer}
                        </span>
                        <h4 className="font-serif font-bold text-base text-forest-900">
                          Projected Readiness Impact
                        </h4>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-muted-600">Current</div>
                          <div className="text-xl font-serif font-bold text-charcoal-700">{simulationResult.current_score}</div>
                        </div>
                        <div className="text-forest-700 font-bold">→</div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-forest-800">Simulated</div>
                          <div className="text-2xl font-serif font-bold text-forest-900">{simulationResult.simulated_score}</div>
                        </div>
                        <span className="badge badge-forest text-xs font-bold">
                          {simulationResult.delta_points > 0 ? '+' : ''}{simulationResult.delta_points} pts
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-600">Academic: </span>
                        <strong>{simulationResult.simulated_dimensions.academic}%</strong>
                      </div>
                      <div>
                        <span className="text-muted-600">Technical: </span>
                        <strong>{simulationResult.simulated_dimensions.technical}%</strong>
                      </div>
                      <div>
                        <span className="text-muted-600">Experience: </span>
                        <strong>{simulationResult.simulated_dimensions.experience}%</strong>
                      </div>
                      <div>
                        <span className="text-muted-600">Practice: </span>
                        <strong>{simulationResult.simulated_dimensions.practice}%</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actionable 7 / 30 / 60-Day Improvement Roadmap */}
              <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#ECE6D9]">
                  <div>
                    <h3 className="text-xl font-serif font-bold text-charcoal-900">
                      Personalized Improvement Roadmap
                    </h3>
                    <p className="text-xs text-muted-600">
                      Structured milestone tasks categorized into 7-day, 30-day, and 60-day horizons.
                    </p>
                  </div>
                  <span className="badge badge-sage text-xs">
                    {roadmapTasks.filter(t => t.completed).length} / {roadmapTasks.length} Completed
                  </span>
                </div>

                <div className="space-y-4">
                  {['7_days', '30_days', '60_days'].map((timeframe) => {
                    const tasksInHorizon = roadmapTasks.filter(t => t.timeframe === timeframe);
                    const label = timeframe === '7_days' ? '7-Day Quick Wins' : timeframe === '30_days' ? '30-Day Project Milestones' : '60-Day Advanced Preparedness';

                    return (
                      <div key={timeframe} className="rounded-xl border border-[#DFD9CC] bg-warm-50/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-forest-800" />
                          <h4 className="font-serif font-bold text-sm text-charcoal-900 uppercase tracking-wider">
                            {label}
                          </h4>
                        </div>

                        <div className="space-y-2">
                          {tasksInHorizon.map((task) => (
                            <div 
                              key={task.id} 
                              className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors ${
                                task.completed 
                                  ? 'bg-sage-50/80 border-sage-200 text-charcoal-500' 
                                  : 'bg-white border-[#DFD9CC] text-charcoal-800'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggleTask(task.id)}
                                  className="mt-0.5 text-forest-800 hover:text-forest-900"
                                >
                                  {task.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-forest-700" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-muted-400" />
                                  )}
                                </button>
                                <div>
                                  <h5 className={`font-serif font-bold text-sm ${task.completed ? 'line-through text-muted-500' : 'text-charcoal-900'}`}>
                                    {task.title}
                                  </h5>
                                  <p className="mt-0.5 text-muted-600">{task.description}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-500">
                                    <span className="badge badge-amber text-[10px] capitalize">{task.priority} Priority</span>
                                    <span>Effort: {task.estimated_effort}</span>
                                    <span>Goal: {task.completion_criteria}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {tasksInHorizon.length === 0 && (
                            <p className="text-xs text-muted-500 italic py-2">No active tasks in this horizon.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADAPTIVE INTERVIEW PRACTICE */}
          {activeTab === 'interview' && (
            <div className="space-y-8">
              <div className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ECE6D9]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge badge-forest text-xs">Module 5 Adaptive Simulator</span>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-charcoal-900">
                      Technical & Behavioral Interview Practice
                    </h2>
                    <p className="text-xs text-muted-600">
                      Answer role-specific questions and receive structured feedback on depth, structure, and STAR rubric criteria.
                    </p>
                  </div>

                  {/* Target Role Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-muted-600">Role Target:</label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="input text-xs bg-warm-50 border-[#DFD9CC]"
                    >
                      <option value="Fullstack Engineer">Fullstack Engineer</option>
                      <option value="Frontend Developer">Frontend Developer</option>
                      <option value="Backend Developer">Backend Developer</option>
                      <option value="Data Analyst">Data Analyst</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Question Bank List */}
                  <div className="lg:col-span-5 space-y-3">
                    <h3 className="font-serif font-bold text-sm text-charcoal-900 uppercase tracking-wider mb-2">
                      Question Bank ({questions.length})
                    </h3>
                    {questions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setSelectedQuestion(q); setInterviewResult(null); }}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                          selectedQuestion?.question === q.question
                            ? 'bg-sage-100/60 border-forest-700 text-forest-900 font-semibold shadow-soft'
                            : 'bg-warm-50/40 border-[#DFD9CC] text-charcoal-700 hover:bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="badge badge-sage text-[10px] capitalize">{q.category}</span>
                          <span className="text-[10px] text-muted-500 capitalize">{q.difficulty}</span>
                        </div>
                        <p className="line-clamp-2">{q.question}</p>
                      </button>
                    ))}
                  </div>

                  {/* Practice Workspace */}
                  <div className="lg:col-span-7">
                    {selectedQuestion ? (
                      <form onSubmit={submitAnswer} className="space-y-4">
                        <div className="p-4 rounded-xl bg-warm-50 border border-[#E5DFD3]">
                          <span className="badge badge-forest text-[10px] capitalize mb-1">
                            {selectedQuestion.category} Evaluation
                          </span>
                          <h4 className="font-serif font-bold text-base text-charcoal-900">
                            {selectedQuestion.question}
                          </h4>
                          <p className="text-[11px] text-muted-600 mt-2 italic">
                            Tip: For technical questions, mention trade-offs and complexity. For behavioral, use Situation, Task, Action, Result.
                          </p>
                        </div>

                        <div>
                          <label className="form-label text-xs">Your Structured Response</label>
                          <textarea
                            rows={6}
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Draft your detailed answer here..."
                            className="input text-xs w-full font-mono bg-white border-[#DFD9CC]"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingInterview || !answerText.trim()}
                          className="btn btn-primary text-xs px-6 py-2.5 flex items-center gap-1.5 shadow-soft"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {submittingInterview ? 'Evaluating Answer...' : 'Submit Response for Feedback'}
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-muted-500 py-10 text-center">Select a question to practice.</p>
                    )}

                    {/* Instant Feedback Result */}
                    {interviewResult && (
                      <div className="mt-6 p-5 rounded-xl bg-sage-50 border border-sage-200 text-xs">
                        <div className="flex justify-between items-center pb-3 border-b border-sage-200 mb-3">
                          <span className="font-serif font-bold text-base text-forest-900">
                            Feedback & Evaluation
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-600">Rubric Score:</span>
                            <span className="badge badge-forest text-sm font-bold">
                              {interviewResult.score} / 100
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-forest-900">
                            <strong>Observed Strengths:</strong> {interviewResult.feedback?.strengths}
                          </p>
                          <p className="text-amber-900">
                            <strong>Improvement Focus:</strong> {interviewResult.feedback?.gaps}
                          </p>
                          <p className="text-charcoal-700 italic">
                            "{interviewResult.feedback?.recommendation}"
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attempt History */}
                {interviewHistory.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-[#ECE6D9]">
                    <h3 className="font-serif font-bold text-sm text-charcoal-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-forest-800" />
                      Past Interview Attempts ({interviewHistory.length})
                    </h3>
                    <div className="space-y-2">
                      {interviewHistory.slice(0, 5).map((att) => (
                        <div key={att.id} className="p-3 rounded-lg border border-[#DFD9CC] bg-warm-50/50 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-serif font-bold text-charcoal-900">{att.role_target}</span>
                            <span className="text-muted-500 ml-2">({att.category})</span>
                            <p className="text-muted-600 truncate max-w-md">{att.question}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="badge badge-forest text-xs font-semibold">{att.score}/100</span>
                            <span className="text-[10px] text-muted-500">{new Date(att.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CAREER PATHWAYS & RECOMMENDATIONS */}
          {activeTab === 'paths' && (
            <div className="space-y-6">
              {recommendations.map((rec) => (
                <article key={rec.title} className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECE6D9]">
                    <div>
                      <h3 className="text-2xl font-serif font-bold text-charcoal-900">{rec.title}</h3>
                      <p className="mt-1 text-xs text-muted-600">{rec.reason}</p>
                    </div>
                    <span className="badge badge-forest text-sm font-semibold">{rec.match_score}% Skills Fit</span>
                  </div>

                  <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-forest-900">Recommended Skills</h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rec.skills.map((skill) => {
                      const isMissing = rec.missing_skills?.includes(skill);
                      return (
                        <span 
                          key={skill} 
                          className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                            isMissing 
                              ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                              : 'bg-sage-100 text-forest-900 border border-sage-300'
                          }`}
                        >
                          {skill} {isMissing && '(Skill Gap)'}
                        </span>
                      );
                    })}
                  </div>

                  <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-forest-900">Strategic Next Steps</h4>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-charcoal-700 font-sans">
                    {rec.roadmap.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </article>
              ))}

              {!recommendations.length && (
                <p className="text-xs text-muted-500 py-10 text-center">
                  No career pathways available yet. Update your profile skills to generate personalized recommendations.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
