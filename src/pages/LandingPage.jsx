import { 
  ArrowRight, 
  Briefcase, 
  GraduationCap, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Compass, 
  FileCheck2, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Activity,
  Sliders,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';

const modules = [
  { id: 1, title: 'Auth & Role Governance', desc: 'Fine-grained access control across Student, Recruiter, Officer, and Administrator tiers.', icon: ShieldCheck },
  { id: 2, title: 'Academic Profile Management', desc: 'Holistic portfolio tracking CGPA, departmental credentials, verified projects, and career preferences.', icon: GraduationCap },
  { id: 3, title: 'Company & Requisition Suite', desc: 'Structured role postings with criteria, departmental targeting, and interview tracking.', icon: Briefcase },
  { id: 4, title: 'Explainable Eligibility Engine', desc: 'Transparent rule evaluation distinguishing mandatory institutional criteria from preferred qualifications.', icon: CheckCircle2 },
  { id: 5, title: 'AI-Based Career Guidance', desc: 'Placement Readiness Twin with 4-dimension scoring, What-If simulator, and dynamic roadmaps.', icon: Compass },
  { id: 6, title: 'Resume Analysis & Skill Verification', desc: 'Parsing alongside 4-tier skill validation (Self-reported, Quiz-assessed, GitHub evidence, Verified).', icon: FileCheck2 },
  { id: 7, title: 'Application & Feedback Loop', desc: 'End-to-end recruitment lifecycle with actionable recruiter feedback linked to candidate readiness.', icon: Layers },
  { id: 8, title: 'Intelligence & Deadline Assistant', desc: 'Predictive placement analytics, skill-demand forecasting, and prioritized deadline notifications.', icon: Clock }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory text-charcoal-900 font-sans selection:bg-sage-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E3DDCF] bg-ivory/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-forest-900 text-ivory flex items-center justify-center font-serif text-xl font-bold shadow-soft">
              P
            </div>
            <div>
              <span className="font-serif text-2xl font-bold text-forest-900 tracking-tight">PlacementIQ</span>
              <span className="hidden sm:inline-block ml-2 text-xs uppercase tracking-widest text-muted-600 font-medium">
                Eco-Intelligence Editorial
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex text-sm font-medium text-charcoal-700">
            <a href="#readiness-twin" className="hover:text-forest-900 transition-colors">Readiness Twin</a>
            <a href="#modules" className="hover:text-forest-900 transition-colors">8 Core Modules</a>
            <a href="#ecosystem" className="hover:text-forest-900 transition-colors">Stakeholders</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="btn btn-secondary text-xs sm:text-sm py-2 px-4">
              Sign In
            </Link>
            <Link to="/auth" className="btn btn-primary text-xs sm:text-sm py-2 px-4 shadow-soft">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 sm:py-24 border-b border-[#E3DDCF]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-50/60 px-3.5 py-1 text-xs font-semibold text-forest-800 uppercase tracking-widest mb-6">
                  <Sparkles className="w-3.5 h-3.5 text-forest-700" />
                  Campus Career Intelligence Platform
                </div>
                <h1 className="text-4xl font-serif font-bold tracking-tight text-charcoal-900 sm:text-5xl lg:text-6xl leading-[1.12]">
                  Connect students, recruiters, and placement teams.
                </h1>
                <p className="mt-6 text-lg text-charcoal-700 leading-relaxed font-normal max-w-2xl">
                  An institutional career intelligence environment merging rigorous academic compliance with 
                  explainable AI matching, verified skill credentials, and the Placement Readiness Twin.
                </p>
                
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link to="/auth" className="btn btn-primary text-base px-7 py-3 shadow-soft inline-flex items-center gap-2">
                    Start Your Placement Journey <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/jobs" className="btn btn-secondary text-base px-6 py-3">
                    Explore Requisitions
                  </Link>
                </div>

                <div className="mt-10 grid grid-cols-3 gap-6 pt-8 border-t border-[#E3DDCF]">
                  <div>
                    <div className="text-2xl font-serif font-bold text-forest-900">8 Modules</div>
                    <div className="text-xs text-muted-600 mt-1 uppercase tracking-wide">Unified Platform</div>
                  </div>
                  <div>
                    <div className="text-2xl font-serif font-bold text-forest-900">100% Explainable</div>
                    <div className="text-xs text-muted-600 mt-1 uppercase tracking-wide">Eligibility Logic</div>
                  </div>
                  <div>
                    <div className="text-2xl font-serif font-bold text-forest-900">4-Tier Verification</div>
                    <div className="text-xs text-muted-600 mt-1 uppercase tracking-wide">Evidence-Based Skills</div>
                  </div>
                </div>
              </div>

              {/* Placement Readiness Twin Visual Preview Card */}
              <div className="lg:col-span-5">
                <div className="card p-6 bg-white border border-[#DFD9CC] shadow-card rounded-2xl relative">
                  <div className="flex items-center justify-between pb-4 border-b border-[#ECE6D9]">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-forest-800" />
                      <span className="font-serif font-bold text-charcoal-900">Placement Readiness Twin</span>
                    </div>
                    <span className="badge badge-forest text-xs font-semibold">Live Diagnosis</span>
                  </div>

                  <div className="mt-5 p-4 rounded-xl bg-warm-50 border border-[#E5DFD3]">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-600">Aggregate Readiness Score</span>
                      <span className="text-3xl font-serif font-bold text-forest-900">78<span className="text-sm font-sans font-normal text-muted-500">/100</span></span>
                    </div>
                    <div className="h-2 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                      <div className="h-full bg-forest-800 rounded-full" style={{ width: '78%' }} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-600">
                      Calculated across Academic Standing, Technical Coverage, Project Evidence & Interview Preparedness.
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-charcoal-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" /> Academic & Eligibility Fit
                      </span>
                      <span className="font-semibold text-forest-900">85%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-charcoal-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" /> Technical Skills & Quiz Verification
                      </span>
                      <span className="font-semibold text-forest-900">75%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-charcoal-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" /> Portfolio & GitHub Evidence
                      </span>
                      <span className="font-semibold text-forest-900">70%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-charcoal-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" /> Mock Interview Performance
                      </span>
                      <span className="font-semibold text-forest-900">80%</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#ECE6D9] flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-600">
                      <Sliders className="w-3.5 h-3.5 text-forest-700" />
                      What-If Simulator Active
                    </div>
                    <Link to="/auth" className="text-xs font-semibold text-forest-800 hover:text-forest-900 underline">
                      Run Your Diagnosis →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Spotlight: Placement Readiness Twin */}
        <section id="readiness-twin" className="py-20 bg-warm-50/70 border-b border-[#E3DDCF]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-3xl mb-12">
              <span className="text-xs font-bold uppercase tracking-widest text-forest-800">Module 5 Feature Spotlight</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-charcoal-900">
                The Placement Readiness Twin
              </h2>
              <p className="mt-3 text-base text-charcoal-700 leading-relaxed">
                A dynamic, personalized digital representation of every student’s institutional placement readiness. 
                Move beyond guesswork with simulated scenarios, structured roadmaps, and verifiable skill proof.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="card p-6 bg-white border border-[#DFD9CC]">
                <div className="h-10 w-10 rounded-lg bg-forest-50 border border-forest-200 text-forest-800 flex items-center justify-center mb-4">
                  <Sliders className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-charcoal-900">What-If Simulation</h3>
                <p className="mt-2 text-sm text-charcoal-700 leading-relaxed">
                  Hypothetically add missing target skills or completed repositories to see exact projected score increases before committing time.
                </p>
              </div>

              <div className="card p-6 bg-white border border-[#DFD9CC]">
                <div className="h-10 w-10 rounded-lg bg-forest-50 border border-forest-200 text-forest-800 flex items-center justify-center mb-4">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-charcoal-900">7, 30 & 60-Day Roadmaps</h3>
                <p className="mt-2 text-sm text-charcoal-700 leading-relaxed">
                  Tailored milestone tasks with clear rationales, estimated effort, and completion criteria persisted in your student profile.
                </p>
              </div>

              <div className="card p-6 bg-white border border-[#DFD9CC]">
                <div className="h-10 w-10 rounded-lg bg-forest-50 border border-forest-200 text-forest-800 flex items-center justify-center mb-4">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-charcoal-900">Evidence-Based Tiers</h3>
                <p className="mt-2 text-sm text-charcoal-700 leading-relaxed">
                  Categorizes capabilities across Self-Reported, Skill-Quiz Assessed, Project-Evidenced, and Officially Verified tiers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8-Module Architecture Grid */}
        <section id="modules" className="py-20 bg-ivory border-b border-[#E3DDCF]">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-widest text-forest-800">System Architecture</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-charcoal-900">
                Eight Unified Core Modules
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-600">
                Strictly architected to deliver institutional compliance, transparency, and actionable intelligence.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.id} className="card p-6 bg-white border border-[#DFD9CC] flex flex-col justify-between hover:border-forest-700 transition-colors">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-forest-800 uppercase tracking-wider">
                          Module 0{m.id}
                        </span>
                        <div className="h-8 w-8 rounded-md bg-sage-100/60 text-forest-900 flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <h3 className="font-serif text-base font-bold text-charcoal-900 mb-2">
                        {m.title}
                      </h3>
                      <p className="text-xs text-charcoal-700 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stakeholder Ecosystem */}
        <section id="ecosystem" className="py-20 bg-forest-900 text-ivory">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-sage-300">Target Ecosystem</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-bold text-white">
                Empowering Every Placement Stakeholder
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="p-6 rounded-2xl bg-[#295A45] border border-[#387258]">
                <h3 className="font-serif text-xl font-bold text-white mb-2">Students</h3>
                <p className="text-sm text-sage-100 leading-relaxed mb-4">
                  Diagnose placement readiness, verify skill competencies through live quizzes and repository links, and apply with instant eligibility transparency.
                </p>
                <div className="text-xs text-sage-200 font-medium">✓ Transparent Eligibility Breakdown</div>
                <div className="text-xs text-sage-200 font-medium mt-1">✓ Interview Practice Simulator</div>
              </div>

              <div className="p-6 rounded-2xl bg-[#295A45] border border-[#387258]">
                <h3 className="font-serif text-xl font-bold text-white mb-2">Recruiters</h3>
                <p className="text-sm text-sage-100 leading-relaxed mb-4">
                  Publish requisitions with academic cutoffs, inspect verified candidate evidence tiers, schedule interviews, and return structured candidate feedback.
                </p>
                <div className="text-xs text-sage-200 font-medium">✓ Evidence-Based Candidate Review</div>
                <div className="text-xs text-sage-200 font-medium mt-1">✓ Integrated Feedback Loop</div>
              </div>

              <div className="p-6 rounded-2xl bg-[#295A45] border border-[#387258]">
                <h3 className="font-serif text-xl font-bold text-white mb-2">Placement Officers & Admins</h3>
                <p className="text-sm text-sage-100 leading-relaxed mb-4">
                  Monitor departmental conversion funnels, track skill-demand trends, manage campus drives, and moderate platform security and users.
                </p>
                <div className="text-xs text-sage-200 font-medium">✓ Placement Funnel Analytics</div>
                <div className="text-xs text-sage-200 font-medium mt-1">✓ Governance & Role Oversight</div>
              </div>
            </div>

            {/* Bottom Call to action */}
            <div className="mt-16 pt-10 border-t border-[#387258] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <h4 className="font-serif text-2xl font-bold text-white">Ready to elevate your campus placement outcomes?</h4>
                <p className="text-sm text-sage-200 mt-1">Sign in with your institutional credentials or create a new profile.</p>
              </div>
              <Link to="/auth" className="btn bg-white text-forest-900 hover:bg-sage-100 font-semibold px-8 py-3 rounded-lg shadow-card text-sm">
                Get Started Now
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E3DDCF] bg-ivory py-8 text-center text-xs text-muted-600">
        <p>© 2026 PlacementIQ. AI-Based Placement Management & Career Guidance System. Eco-Intelligence Editorial Edition.</p>
      </footer>
    </div>
  );
}
