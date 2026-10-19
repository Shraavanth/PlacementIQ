import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  UserCheck, 
  GraduationCap, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  Award,
  ArrowRight
} from 'lucide-react';
import Layout from '../components/Layout';

const emptyProfile = {
  first_name: '',
  last_name: '',
  student_id: '',
  phone: '',
  university: '',
  degree: '',
  department: '',
  graduation_year: '',
  cgpa: '',
  preferred_roles: '',
  preferred_locations: '',
  preferred_industries: '',
  skills: '',
  certifications: '',
  projects: '',
  internships: ''
};

const listFields = ['preferred_roles', 'preferred_locations', 'preferred_industries', 'skills', 'certifications', 'projects', 'internships'];
const splitList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function StudentProfile() {
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    let active = true;
    fetch('/api/student/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your profile.');
        const values = { ...emptyProfile, ...data.profile };
        for (const field of listFields) values[field] = (data.profile[field] || []).join(', ');
        if (active) setProfile(values);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load your profile.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  const completion = useMemo(() => {
    const fields = ['first_name', 'last_name', 'phone', 'university', 'degree', 'department', 'graduation_year', 'cgpa', 'skills', 'projects'];
    const complete = fields.filter((field) => String(profile[field] || '').trim()).length;
    return Math.round(complete * 100 / fields.length);
  }, [profile]);

  const change = (event) => {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
    setMessage('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { ...profile };
    for (const field of listFields) payload[field] = splitList(profile[field]);
    payload.graduation_year = profile.graduation_year ? Number(profile.graduation_year) : null;
    payload.cgpa = profile.cgpa ? Number(profile.cgpa) : null;
    try {
      const response = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');
      const values = { ...emptyProfile, ...data.profile };
      for (const field of listFields) values[field] = (data.profile[field] || []).join(', ');
      setProfile(values);
      setMessage('Profile saved successfully.');
    } catch (err) {
      setError(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const textFields = [
    ['first_name', 'First name', true], ['last_name', 'Last name', true],
    ['student_id', 'Student ID'], ['phone', 'Phone number'], ['university', 'University'],
    ['degree', 'Degree'], ['department', 'Department'], ['graduation_year', 'Graduation year'],
    ['cgpa', 'CGPA']
  ];
  const listLabels = [
    ['skills', 'Skills'], ['preferred_roles', 'Preferred roles'], ['preferred_locations', 'Preferred locations'],
    ['preferred_industries', 'Preferred industries'], ['certifications', 'Certifications'],
    ['projects', 'Projects'], ['internships', 'Internships']
  ];

  return (
    <Layout title="Student Academic Profile" role="student">
      {/* Top Banner */}
      <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-forest text-xs font-semibold">Module 2</span>
              <span className="text-xs text-muted-600 font-medium">Student Profile Governance</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-charcoal-900">
              Institutional Profile & Credentials
            </h2>
            <p className="mt-1 text-xs text-muted-600 max-w-2xl leading-relaxed">
              Maintain verified academic metrics, departmental records, and project portfolios to ensure 
              eligibility engine compliance and maximize your Placement Readiness Twin score.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-sage text-xs">
              Profile Score: {completion}%
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <p role="status" className="font-serif italic text-muted-600 py-10">
          Loading student credentials...
        </p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-3">
          <form className="card p-6 sm:p-8 bg-white border border-[#DFD9CC] shadow-soft xl:col-span-2" onSubmit={save}>
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#ECE6D9]">
              <GraduationCap className="w-5 h-5 text-forest-800" />
              <h3 className="text-lg font-serif font-bold text-charcoal-900">
                Academic & Personal Information
              </h3>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {textFields.map(([name, label, required]) => (
                <label key={name} className="block text-xs font-serif font-bold text-charcoal-900">
                  {label} {required && <span className="text-ruby-700">*</span>}
                  <input
                    className="input mt-1.5 text-xs w-full bg-warm-50/60 border-[#DFD9CC] font-sans font-normal"
                    name={name}
                    type={name === 'cgpa' || name === 'graduation_year' ? 'number' : 'text'}
                    min={name === 'cgpa' ? 0 : name === 'graduation_year' ? 1900 : undefined}
                    max={name === 'cgpa' ? 10 : name === 'graduation_year' ? 2200 : undefined}
                    step={name === 'cgpa' ? '0.01' : undefined}
                    required={required}
                    value={profile[name]}
                    onChange={change}
                  />
                </label>
              ))}

              {listLabels.map(([name, label]) => (
                <label key={name} className="block text-xs font-serif font-bold text-charcoal-900 md:col-span-2">
                  {label} <span className="font-normal font-sans text-muted-500">(comma-separated items)</span>
                  <textarea 
                    className="input mt-1.5 min-h-16 text-xs w-full bg-warm-50/60 border-[#DFD9CC] font-sans font-normal" 
                    name={name} 
                    value={profile[name]} 
                    onChange={change} 
                  />
                </label>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-ruby-50 border border-ruby-200 p-3 text-xs text-ruby-800">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="mt-4 rounded-lg bg-sage-50 border border-sage-200 p-3 text-xs text-forest-800 font-semibold">
                {message}
              </p>
            )}

            <div className="mt-8 pt-4 border-t border-[#ECE6D9] flex items-center justify-between">
              <button 
                type="submit" 
                className="btn btn-primary text-xs px-7 py-2.5 shadow-soft" 
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>

          {/* Profile Completeness & Guidance Sidebar */}
          <aside className="space-y-6">
            <div className="card p-6 bg-white border border-[#DFD9CC] shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-base text-charcoal-900">Profile Completeness</h3>
                <span className="text-xs font-bold text-forest-900">{completion}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E5DFD3] overflow-hidden">
                <div 
                  className="h-full rounded-full bg-forest-800 transition-all duration-500" 
                  style={{ width: `${completion}%` }} 
                />
              </div>
              <p className="mt-3 text-xs text-muted-600 font-medium">
                {completion}% complete
              </p>
              <p className="mt-4 text-xs text-charcoal-700 leading-relaxed font-sans">
                Accurate academic credentials, CGPA records, and project repositories power the 
                explainable matching engine and ensure you pass institutional screening.
              </p>

              <div className="mt-6 pt-4 border-t border-[#ECE6D9]">
                <a 
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800 hover:text-forest-900 underline" 
                  href="/resume"
                >
                  Upload and analyze resume <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="card p-6 bg-warm-50 border border-[#E5DFD3]">
              <div className="flex items-center gap-2 mb-2 text-forest-900">
                <Award className="w-4 h-4" />
                <h4 className="font-serif font-bold text-sm">Need Skill Evidence?</h4>
              </div>
              <p className="text-xs text-charcoal-700 leading-relaxed">
                Elevate your self-reported skills to verified status. Attach GitHub repositories or complete skill quizzes.
              </p>
              <Link to="/resume" className="mt-3 inline-block text-xs font-semibold text-forest-800 underline">
                Go to Evidence Suite →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </Layout>
  );
}
