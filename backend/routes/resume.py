import os
import re
import uuid
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
import fitz
from werkzeug.utils import secure_filename
from sqlalchemy.exc import SQLAlchemyError
from backend.extensions import db
from backend.models import Resume, User
from backend.utils import extract_education_from_text, extract_skills_from_text
try:
    from backend.departments import normalize_department, DEPARTMENT_MAPPINGS
except ImportError:
    from departments import normalize_department, DEPARTMENT_MAPPINGS

blueprint = Blueprint('resume', __name__, url_prefix='/api/resume')


def extract_profile_fields(text):
    if not text:
        return {'needs_confirmation': {'department': True, 'graduation_year': True}}

    def labeled_value(label):
        match = re.search(rf'(?im)^\s*{label}\s*[:\-]\s*(.+?)\s*(?:\||$)', text)
        return match.group(1).strip() if match else None

    fields = {}
    needs_confirmation = {}

    name = labeled_value(r'(?:full\s+)?name')
    if name:
        parts = name.split()
        if len(parts) >= 2:
            fields['first_name'] = parts[0]
            fields['last_name'] = ' '.join(parts[1:])

    email = re.search(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', text, re.IGNORECASE)
    if email:
        fields['email'] = email.group(0)
    phone = re.search(r'(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)', text)
    if phone:
        fields['phone'] = phone.group(0).strip()

    for label in (r'(?:university|institution|college)',):
        value = labeled_value(label)
        if value:
            fields['university'] = value
            break

    degree_val = labeled_value(r'(?:degree|qualification)')
    if degree_val:
        fields['degree'] = degree_val
    else:
        degrees = extract_education_from_text(text)
        if degrees:
            fields['degree'] = degrees[0]

    # Target/preferred departments: must NOT be confused with actual academic department
    target_depts = []
    target_match = re.search(r'(?im)\b(?:target|preferred)\s+(?:departments?|branches?)\s*[:\-]\s*(.+?)\s*(?:\||\n|$)', text)
    if target_match:
        raw_targets = target_match.group(1)
        for t in re.split(r'[,;/|]+', raw_targets):
            t_clean = t.strip()
            if t_clean:
                target_depts.append(normalize_department(t_clean))
        if target_depts:
            fields['target_departments'] = target_depts

    # Actual Academic Department
    dept_val = None
    # 1. Search for explicit department label that is NOT target or preferred
    dept_match = re.search(r'(?im)(?<!target\s)(?<!preferred\s)\b(?:academic\s+department|department|branch|major|speciali[sz]ation)\s*[:\-]\s*(.+?)\s*(?:\||\n|$)', text)
    if dept_match:
        cand = dept_match.group(1).strip()
        if 'target' not in cand.lower() and 'preferred' not in cand.lower():
            dept_val = cand

    # 2. If no label, search in lines mentioning degree or education
    if not dept_val:
        edu_matches = re.finditer(r'(?im)^.*?\b(?:b\.?tech|b\.?e\.?|m\.?tech|bachelor|master|degree)\b.*$', text)
        for em in edu_matches:
            edu_line = em.group(0)
            if any(k in edu_line.lower() for k in ['project', 'experience', 'internship', 'target']):
                continue
            for cand_alias, canonical in DEPARTMENT_MAPPINGS.items():
                if len(cand_alias) > 3:
                    if re.search(rf'\b{re.escape(cand_alias)}\b', edu_line, re.IGNORECASE):
                        dept_val = canonical
                        break
            if dept_val:
                break
            for abbr in ['cse', 'ece', 'eee', 'it', 'mech', 'civil', 'aids', 'aiml']:
                if re.search(rf'\b{abbr}\b', edu_line, re.IGNORECASE):
                    dept_val = DEPARTMENT_MAPPINGS.get(abbr)
                    break
            if dept_val:
                break

    if dept_val:
        normalized = normalize_department(dept_val)
        fields['department'] = normalized
        # Request confirmation if department is non-standard or multiple depts combined
        if normalized not in DEPARTMENT_MAPPINGS.values() and (',' in dept_val or len(dept_val) > 40):
            needs_confirmation['department'] = True
        else:
            needs_confirmation['department'] = False
    else:
        needs_confirmation['department'] = True

    # Graduation Year: recognize Graduation Year, Year of Graduation, Passing Year, etc.
    grad_year = None
    # 1. Explicit label (handles Passing Year, Graduation Year, Year of Passing, etc.)
    year_match = re.search(
        r'(?im)\b(?:graduation\s+year|year\s+of\s+graduation|passing\s+year|year\s+of\s+passing|graduating\s+year|expected\s+graduation|batch\s+of|class\s+of)\s*[:\-]?\s*(?:(?:19|20|21)\d{2}\s*[-–/]\s*)?((?:19|20|21)\d{2})\b',
        text
    )
    if year_match:
        try:
            cand = int(year_match.group(1))
            if 1900 <= cand <= 2200:
                grad_year = cand
        except (ValueError, TypeError):
            pass

    # 2. Date range or single year beside degree/education details (avoiding project/job dates)
    if not grad_year:
        edu_matches = re.finditer(r'(?im)^.*?\b(?:b\.?tech|b\.?e\.?|m\.?tech|bachelor|master|degree|diploma)\b.*$', text)
        for em in edu_matches:
            line = em.group(0)
            if any(k in line.lower() for k in ['project', 'experience', 'internship', 'published']):
                continue
            range_match = re.search(r'\b(?:19|20|21)\d{2}\s*[-–/to]+\s*((?:19|20|21)\d{2})\b', line, re.IGNORECASE)
            if range_match:
                cand = int(range_match.group(1))
                if 1900 <= cand <= 2200:
                    grad_year = cand
                    break
            single_year = re.search(r'\b((?:19|20|21)\d{2})\b', line)
            if single_year:
                cand = int(single_year.group(1))
                if 1900 <= cand <= 2200:
                    grad_year = cand
                    break

    # 3. PDF table row for Passing/Graduation Year
    if not grad_year:
        table_year = re.search(r'(?i)\b(?:passing\s+year|grad(?:uation)?\s+year)\s*\|?\s*((?:19|20|21)\d{2})\b', text)
        if table_year:
            try:
                cand = int(table_year.group(1))
                if 1900 <= cand <= 2200:
                    grad_year = cand
            except (ValueError, TypeError):
                pass

    if grad_year:
        fields['graduation_year'] = grad_year
        needs_confirmation['graduation_year'] = False
    else:
        needs_confirmation['graduation_year'] = True

    # CGPA
    cgpa_match = re.search(r'(?im)\b(?:cgpa|gpa)\s*[:\-]?\s*(\b(?:10(?:\.0+)?|[0-9](?:\.\d{1,2})?)\b)(?:\s*/\s*10(?:\.0+)?)?', text)
    if cgpa_match:
        try:
            value = float(cgpa_match.group(1))
            if 0 <= value <= 10:
                fields['cgpa'] = value
        except (ValueError, TypeError):
            pass

    links = sorted(set(re.findall(r'https?://[^\s<>]+', text, re.IGNORECASE)))
    if links:
        fields['links'] = links

    section_names = {
        'projects': 'projects',
        'project': 'projects',
        'certifications': 'certifications',
        'certification': 'certifications',
        'internships': 'internships',
        'internship': 'internships',
        'experience': 'internships'
    }
    section_headers = set(section_names)
    other_headers = {
        'education', 'educationalbackground', 'skills', 'technicalskills',
        'summary', 'professionalexperience', 'workexperience', 'contact',
        'achievements', 'awards', 'languages', 'interests'
    }
    current_section = None
    extracted_sections = {key: [] for key in ('projects', 'certifications', 'internships')}
    for line in text.splitlines():
        normalized = re.sub(r'[^a-z]', '', line.strip().lower())
        if normalized in section_headers:
            current_section = section_names[normalized]
            continue
        if normalized in other_headers:
            current_section = None
        if current_section and line.strip():
            item = re.sub(r'^\s*[-*•\d.)]+\s*', '', line).strip()
            if item and item.casefold() not in {value.casefold() for value in extracted_sections[current_section]}:
                extracted_sections[current_section].append(item)
    for field, values in extracted_sections.items():
        if values:
            fields[field] = values[:10]
    skills = extract_skills_from_text(text)
    if skills:
        fields['skills'] = skills

    fields['needs_confirmation'] = needs_confirmation
    return fields


@blueprint.route('/upload', methods=['POST'])
@jwt_required()
def upload_resume():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can upload resumes.'}), 403
    if 'file' not in request.files:
        return jsonify({'error': 'Resume file is required.'}), 400
    uploaded = request.files['file']
    if uploaded.filename == '':
        return jsonify({'error': 'No resume selected.'}), 400
    if not uploaded.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Only PDF resumes are supported.'}), 400
    try:
        with fitz.open(stream=uploaded.read(), filetype='pdf') as doc:
            text_parts = []
            for page in doc:
                try:
                    tables = page.find_tables()
                    for tab in tables:
                        for row in tab.extract():
                            row_str = " | ".join(str(cell or '') for cell in row)
                            text_parts.append(row_str)
                except Exception:
                    pass
                text_parts.append(page.get_text('text'))
            text = '\n'.join(text_parts)
            page_count = len(doc)
    except (fitz.FileDataError, fitz.mupdf.FzErrorBase, ValueError):
        return jsonify({'error': 'The uploaded file is not a readable PDF.'}), 400

    skills = extract_skills_from_text(text)
    education = extract_education_from_text(text)
    safe_filename = secure_filename(uploaded.filename)
    if not safe_filename:
        return jsonify({'error': 'The resume filename is invalid.'}), 400
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, f'{user.id}_{uuid.uuid4().hex}_{safe_filename}')
    uploaded.stream.seek(0)
    uploaded.save(path)
    if not text.strip():
        notes = 'Scanned PDFs without selectable text are not supported.'
    elif skills:
        notes = 'Skill extraction uses a transparent rules-based method.'
    else:
        notes = 'No recognizable skills were found in the selectable text of this PDF.'
    result = {
        'skills': skills,
        'education': education,
        'profile_fields': extract_profile_fields(text),
        'page_count': page_count,
        'text_extracted': bool(text.strip()),
        'notes': notes
    }
    try:
        resume = Resume(user_id=user.id, filename=safe_filename, file_path=path, status='processed' if skills else 'review_required', extracted_skills=skills, analysis=result)
        db.session.add(resume)
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        raise
    return jsonify({'message': 'Resume processed successfully.', 'resume': {
        'id': resume.id, 'filename': resume.filename, 'status': resume.status,
        'uploaded_at': resume.created_at.isoformat() if resume.created_at else None,
        'file_url': f'/api/resume/{resume.id}/file',
        'skills': resume.extracted_skills, 'analysis': resume.analysis
    }})

@blueprint.route('/analysis', methods=['GET'])
@jwt_required()
def analysis():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Resume analysis is available to students.'}), 403
    resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    job_id = request.args.get('job_id', type=int)
    result = dict(resume.analysis or {}) if resume else {'skills': [], 'notes': 'No resume available.'}
    if not resume and job_id:
        result['skills'] = []
    if job_id:
        from backend.models import Job
        job = Job.query.filter_by(id=job_id, status='Published').first_or_404()
        extracted = {skill.casefold() for skill in (resume.extracted_skills or [])} if resume else set()
        result['job_id'] = job.id
        result['missing_skills'] = [skill for skill in (job.required_skills or []) if skill.casefold() not in extracted]
        result['skill_gap_guidance'] = [
            f'Build a project or complete a course using {skill}.'
            for skill in result['missing_skills']
        ]
    resume_data = {
        'id': resume.id, 'filename': resume.filename, 'status': resume.status,
        'uploaded_at': resume.created_at.isoformat() if resume.created_at else None,
        'file_url': f'/api/resume/{resume.id}/file',
        'skills': resume.extracted_skills
    } if resume else None
    return jsonify({'resume': resume_data, 'analysis': result})


@blueprint.route('/<int:resume_id>/file', methods=['GET'])
@jwt_required()
def download_resume(resume_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can access resume files.'}), 403
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first_or_404()
    if not os.path.isfile(resume.file_path):
        return jsonify({'error': 'The stored resume file is unavailable.'}), 404
    return send_file(resume.file_path, mimetype='application/pdf', as_attachment=False, download_name=resume.filename)


@blueprint.route('', methods=['DELETE'])
@jwt_required()
def clear_resumes():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can clear resume information.'}), 403

    resumes = Resume.query.filter_by(user_id=user.id).all()
    paths = [resume.file_path for resume in resumes]
    profile = user.student_profile
    if profile:
        values_to_clear = {
            'first_name': '',
            'last_name': '',
            'phone': '',
            'university': '',
            'degree': '',
            'department': '',
            'graduation_year': None,
            'cgpa': None,
            'skills': [],
            'certifications': [],
            'projects': [],
            'internships': []
        }
        sources = dict(profile.field_sources or {})
        for field, value in values_to_clear.items():
            source = sources.get(field)
            if isinstance(source, dict) and 'resume' in source and field in {'skills', 'certifications', 'projects', 'internships'}:
                manual_values = list(source.get('manual') or [])
                existing_values = getattr(profile, field) or []
                resume_values = {str(item).casefold() for item in source.get('resume') or []}
                remaining = [
                    item for item in existing_values
                    if str(item).casefold() not in resume_values or str(item).casefold() in {str(v).casefold() for v in manual_values}
                ]
                setattr(profile, field, remaining)
                if manual_values:
                    sources[field] = {'manual': manual_values}
                else:
                    sources.pop(field, None)
            elif source == 'resume':
                setattr(profile, field, value)
                sources.pop(field, None)
        profile.field_sources = sources

    for resume in resumes:
        db.session.delete(resume)
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({'error': 'Could not clear saved resume information. Your saved data was preserved.'}), 500

    for path in paths:
        try:
            os.remove(path)
        except FileNotFoundError:
            continue
    return jsonify({'message': 'Resume files and resume-derived profile fields were cleared.'})
