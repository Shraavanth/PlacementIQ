import os
import uuid
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
import fitz
from werkzeug.utils import secure_filename
from backend.extensions import db
from backend.models import Resume, User
from backend.utils import extract_education_from_text, extract_skills_from_text

blueprint = Blueprint('resume', __name__, url_prefix='/api/resume')

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
        'page_count': page_count,
        'text_extracted': bool(text.strip()),
        'notes': notes
    }
    resume = Resume(user_id=user.id, filename=uploaded.filename, file_path=path, status='processed' if skills else 'review_required', extracted_skills=skills, analysis=result)
    if user.student_profile and skills:
        current_skills = {skill.casefold(): skill for skill in (user.student_profile.skills or [])}
        for skill in skills:
            current_skills.setdefault(skill.casefold(), skill)
        user.student_profile.skills = sorted(current_skills.values())
    db.session.add(resume)
    db.session.commit()
    return jsonify({'message': 'Resume processed successfully.', 'resume': {'id': resume.id, 'status': resume.status, 'skills': resume.extracted_skills, 'analysis': resume.analysis}})

@blueprint.route('/analysis', methods=['GET'])
@jwt_required()
def analysis():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
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
    resume_data = {'id': resume.id, 'status': resume.status, 'skills': resume.extracted_skills} if resume else None
    return jsonify({'resume': resume_data, 'analysis': result})
