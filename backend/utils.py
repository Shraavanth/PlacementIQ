import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

SKILL_MAP = {
    'python': 'Python',
    'sql': 'SQL',
    'flask': 'Flask',
    'django': 'Django',
    'react': 'React',
    'javascript': 'JavaScript',
    'java': 'Java',
    'c++': 'C++',
    'aws': 'AWS',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'machine learning': 'Machine Learning',
    'data analysis': 'Data Analysis',
    'power bi': 'Power BI',
    'tableau': 'Tableau',
    'html': 'HTML',
    'css': 'CSS',
    'rest api': 'REST API',
    'mysql': 'MySQL',
    'mongodb': 'MongoDB',
    'node': 'Node.js',
    'typescript': 'TypeScript',
    'excel': 'Excel'
}

def normalize_skill_name(raw):
    if not raw:
        return None
    text = raw.strip().lower()
    if text in SKILL_MAP:
        return SKILL_MAP[text]
    return raw.strip()


def extract_skills_from_text(text):
    if not text:
        return []
    found = {
        value for key, value in SKILL_MAP.items()
        if re.search(rf'(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])', text, re.IGNORECASE)
    }
    return sorted(found)


def extract_education_from_text(text):
    if not text:
        return []
    education_terms = [
        'B.Tech', 'B.E.', 'Bachelor of Technology', 'Bachelor of Engineering',
        'B.Sc', 'Bachelor of Science', 'M.Tech', 'Master of Technology',
        'M.Sc', 'Master of Science', 'MCA', 'MBA', 'Ph.D.'
    ]
    found = []
    for term in education_terms:
        if re.search(rf'(?<![a-z]){re.escape(term)}(?![a-z])', text, re.IGNORECASE):
            found.append(term)
    return found


def normalize_cgpa(value):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
    try:
        cgpa = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not cgpa.is_finite() or cgpa < 0 or cgpa > 10:
        return None
    return float(cgpa)


def compute_eligibility(student_profile, job):
    reasons = []
    criteria_met = []
    criteria_missing = []
    missing_data = []

    student_profile = student_profile or {}
    job = job or {}

    cgpa = normalize_cgpa(student_profile.get('cgpa'))
    min_cgpa = normalize_cgpa(job.get('min_cgpa'))
    if min_cgpa is None:
        min_cgpa = 0.0
    if cgpa is None:
        missing_data.append('cgpa')
        criteria_missing.append('CGPA')
        reasons.append('Add a valid CGPA from 0 to 10 to your profile to check this requirement.')
        cgpa_status = 'missing'
    elif cgpa < min_cgpa:
        reasons.append(f'Your CGPA ({cgpa:g}) is below the required cutoff ({min_cgpa:g}).')
        criteria_missing.append('Minimum CGPA')
        cgpa_status = 'unmet'
    else:
        cgpa_status = 'met'
        criteria_met.append('Minimum CGPA')

    eligible_departments = {str(department).casefold() for department in job.get('eligible_departments') or []}
    dept = student_profile.get('department')
    dept_status = 'not_required'
    if eligible_departments:
        if not dept:
            missing_data.append('department')
            criteria_missing.append('Eligible department')
            reasons.append('Department is missing in your profile.')
            dept_status = 'missing'
        elif str(dept).casefold() not in eligible_departments:
            reasons.append('Department does not match required eligible departments.')
            criteria_missing.append('Eligible department')
            dept_status = 'unmet'
        else:
            criteria_met.append('Department match')
            dept_status = 'met'

    required_skills = job.get('required_skills') or []
    student_skills = {str(skill).casefold() for skill in student_profile.get('skills') or []}
    matched_skills = [s for s in required_skills if str(s).casefold() in student_skills]
    missing_skills = [s for s in required_skills if str(s).casefold() not in student_skills]

    required_graduation_year = job.get('graduation_year')
    student_graduation_year = student_profile.get('graduation_year')
    grad_status = 'not_required'
    if required_graduation_year:
        if not student_graduation_year:
            missing_data.append('graduation_year')
            criteria_missing.append('Graduation year')
            reasons.append('Graduation year is missing for the job requirement.')
            grad_status = 'missing'
        elif int(student_graduation_year) != int(required_graduation_year):
            criteria_missing.append('Graduation year')
            reasons.append(f'Graduation year must be {required_graduation_year}.')
            grad_status = 'unmet'
        else:
            criteria_met.append('Graduation year')
    else:
        criteria_met.append('Graduation year')
        grad_status = 'met'

    eligible = not reasons and not missing_data
    eligibility_status = 'profile_required' if missing_data else 'eligible' if eligible else 'ineligible'

    # Preferred qualifications (non-mandatory alignment)
    preferred_qualifications = []
    preferred_roles = student_profile.get('preferred_roles') or []
    if preferred_roles:
        role_matches = any(r.casefold() in (job.get('title') or '').casefold() for r in preferred_roles)
        preferred_qualifications.append({
            'name': 'Role preference',
            'detail': 'Matches preferred career focus' if role_matches else 'Different from preferred role preferences',
            'matched': role_matches
        })

    preferred_locations = {str(loc).casefold() for loc in student_profile.get('preferred_locations') or []}
    job_loc = job.get('location') or ''
    if preferred_locations and job_loc:
        loc_matches = job_loc.casefold() in preferred_locations
        preferred_qualifications.append({
            'name': 'Location preference',
            'detail': f'Location ({job_loc}) matches target preferences' if loc_matches else f'Job location is {job_loc}',
            'matched': loc_matches
        })

    # Actionable steps for the student to improve match
    actionable_steps = []
    for skill in missing_skills:
        actionable_steps.append(f'Build a project or complete a course using {skill}.')
    if missing_data:
        actionable_steps.append(f'Complete missing profile fields: {", ".join(missing_data)}.')
    if not actionable_steps and not eligible:
        actionable_steps.append('Check department or graduation requirements against job postings.')
    elif not actionable_steps:
        actionable_steps.append('You meet all requirements! Submit your application and keep interview answers ready.')

    # Breakdown dictionary for transparent UI display
    mandatory_breakdown = {
        'cgpa': {
            'required': min_cgpa,
            'actual': cgpa,
            'status': cgpa_status
        },
        'department': {
            'required': job.get('eligible_departments') or ['Any'],
            'actual': dept,
            'status': dept_status
        },
        'graduation_year': {
            'required': required_graduation_year,
            'actual': student_graduation_year,
            'status': grad_status
        },
        'skills': {
            'required_count': len(required_skills),
            'matched_count': len(matched_skills),
            'missing_count': len(missing_skills),
            'status': 'recommendation'
        }
    }

    match_score_info = compute_match_score(student_profile, job, return_breakdown=True)
    skill_match_percentage = round(len(matched_skills) * 100 / len(required_skills)) if required_skills else 100

    return {
        'eligible': eligible,
        'status': eligibility_status,
        'student_cgpa': cgpa,
        'required_cgpa': min_cgpa,
        'cgpa_status': cgpa_status,
        'reasons': reasons or ['All mandatory criteria satisfied.'],
        'criteria_met': criteria_met,
        'criteria_missing': criteria_missing,
        'missing_data': missing_data,
        'matched_skills': matched_skills,
        'missing_skills': missing_skills,
        'skill_match_percentage': skill_match_percentage,
        'mandatory_breakdown': mandatory_breakdown,
        'preferred_qualifications': preferred_qualifications,
        'actionable_steps': actionable_steps,
        'score': match_score_info['score'],
        'score_basis': match_score_info['explanation']
    }


def compute_match_score(student_profile, job, return_breakdown=False):
    if not student_profile:
        return {'score': 0, 'explanation': 'Insufficient profile data'} if return_breakdown else 0

    skills = {str(skill).casefold() for skill in student_profile.get('skills') or []}
    required = {str(skill).casefold() for skill in job.get('required_skills') or []}
    overlap = len(skills.intersection(required))
    max_score = max(len(required), 1)
    skill_component = (overlap / max_score) * 60

    pref_roles = student_profile.get('preferred_roles') or []
    job_title = job.get('title', '')
    role_match = bool(pref_roles and any(role.casefold() in job_title.casefold() for role in pref_roles))
    pref_component = 20 if role_match else 0

    preferred_locations = {str(location).casefold() for location in student_profile.get('preferred_locations') or []}
    job_location = job.get('location', '')
    loc_match = bool(not job_location or job_location.casefold() in preferred_locations)
    location_component = 20 if loc_match else 10

    total = round(skill_component + pref_component + location_component, 1)
    explanation = f'{round(skill_component)}% Skill overlap ({overlap}/{len(required)} required skills) + {pref_component}% Role match + {location_component}% Location fit = {total}% Total Fit'

    if return_breakdown:
        return {'score': total, 'explanation': explanation}
    return total


def make_serialized_job(job):
    return {
        'id': job.id,
        'title': job.title,
        'company_name': job.company.name if job.company else 'Company',
        'location': job.location,
        'description': job.description,
        'required_skills': job.required_skills or [],
        'eligible_departments': job.eligible_departments or [],
        'graduation_year': job.graduation_year,
        'min_cgpa': job.min_cgpa,
        'openings': job.openings,
        'work_mode': job.work_mode,
        'salary': job.salary,
        'status': job.status,
        'eligibility': None,
        'match_score': None,
        'deadline': job.deadline.isoformat() if job.deadline else None
    }


def utc_now():
    return datetime.utcnow()
