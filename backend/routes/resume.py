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

blueprint = Blueprint('resume', __name__, url_prefix='/api/resume')


def extract_profile_fields(text):
    def labeled_value(label):
        match = re.search(rf'(?im)^\s*{label}\s*[:\-]\s*(.+?)\s*$', text)
        return match.group(1).strip() if match else None

    fields = {}
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

    for label, field in (
        (r'(?:university|institution|college)', 'university'),
        (r'(?:degree|qualification)', 'degree'),
        (r'(?:department|major|speciali[sz]ation)', 'department'),
    ):
        value = labeled_value(label)
        if value:
            fields[field] = value
    if 'degree' not in fields:
        degrees = extract_education_from_text(text)
        if degrees:
            fields['degree'] = degrees[0]


    year = labeled_value(r'(?:graduation\s+year|year\s+of\s+graduation)')
    if year:
        match = re.search(r'\b(?:19|20|21)\d{2}\b', year)
        if match:
            fields['graduation_year'] = int(match.group(0))

    cgpa = labeled_value(r'(?:cgpa|gpa)')
    if cgpa:
        match = re.search(r'\b(?:10(?:\.0+)?|[0-9](?:\.\d{1,2})?)\b', cgpa)
        if match:
            value = float(match.group(0))
            if 0 <= value <= 10:
                fields['cgpa'] = value

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
            text = '\n'.join(page.get_text('text') for page in doc)
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
