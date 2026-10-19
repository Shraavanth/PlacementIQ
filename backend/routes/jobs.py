from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import Application, Company, Job, Notification, RecruiterProfile, User
from backend.utils import compute_eligibility, compute_match_score, make_serialized_job

blueprint = Blueprint('jobs', __name__, url_prefix='/api')

@blueprint.route('/jobs', methods=['GET'])
def list_jobs():
    q = Job.query.filter_by(status='Published')
    if request.args.get('search'):
        q = q.filter(Job.title.ilike(f"%{request.args.get('search')}%"))
    jobs = q.order_by(Job.created_at.desc()).all()
    results = []
    for job in jobs:
        item = make_serialized_job(job)
        item['eligibility'] = None
        results.append(item)
    return jsonify({'jobs': results})

@blueprint.route('/jobs/<int:job_id>', methods=['GET'])
def get_job(job_id):
    job = Job.query.filter_by(id=job_id, status='Published').first_or_404()
    return jsonify({'job': make_serialized_job(job)})

@blueprint.route('/jobs', methods=['POST'])
@jwt_required()
def create_job():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role not in {'recruiter', 'officer'}:
        return jsonify({'error': 'Unauthorized to create jobs.'}), 403
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    description = data.get('description')
    if not isinstance(title, str) or not title.strip() or not isinstance(description, str) or not description.strip():
        return jsonify({'error': 'Title and description are required.'}), 400
    try:
        min_cgpa = float(data.get('min_cgpa', 0))
        openings = int(data.get('openings', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'CGPA cutoff and openings must be valid numbers.'}), 400
    if not 0 <= min_cgpa <= 10 or openings < 1:
        return jsonify({'error': 'CGPA cutoff must be between 0 and 10 and openings must be positive.'}), 400
    status = data.get('status', 'Published')
    if not isinstance(status, str) or status not in {'Published', 'Draft'}:
        return jsonify({'error': 'Job status must be Published or Draft.'}), 400
    required_skills = data.get('required_skills', [])
    eligible_departments = data.get('eligible_departments', [])
    if not isinstance(required_skills, list) or not isinstance(eligible_departments, list):
        return jsonify({'error': 'Required skills and eligible departments must be lists.'}), 400
    try:
        deadline = datetime.strptime(data['deadline'], '%Y-%m-%d') if data.get('deadline') else None
    except (TypeError, ValueError):
        return jsonify({'error': 'Deadline must use YYYY-MM-DD format.'}), 400
    company = user.recruiter_profile.company if user.recruiter_profile else None
    if not company:
        company = Company(name='Demo Company', industry='Technology')
        db.session.add(company)
        db.session.flush()
        if not user.recruiter_profile:
            recruiter_profile = RecruiterProfile(user_id=user.id, company_id=company.id, first_name='Recruiter', last_name='User', designation='Hiring Manager')
            db.session.add(recruiter_profile)
        else:
            user.recruiter_profile.company_id = company.id
    job = Job(
        company_id=company.id, recruiter_id=user.id, title=title.strip(), description=description.strip(),
        required_skills=required_skills, min_cgpa=min_cgpa, eligible_departments=eligible_departments,
        graduation_year=data.get('graduation_year'), location=data.get('location'), work_mode=data.get('work_mode'), salary=data.get('salary'),
        deadline=deadline, openings=openings, status=status
    )
    db.session.add(job)
    db.session.commit()
    return jsonify({'message': 'Job created successfully.', 'job': make_serialized_job(job)}), 201

@blueprint.route('/jobs/<int:job_id>/eligibility', methods=['GET'])
@jwt_required()
def job_eligibility(job_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Eligibility check requires a student account.'}), 403
    job = Job.query.get_or_404(job_id)
    profile = user.student_profile or {}
    student_data = {
        'cgpa': profile.cgpa if profile and profile.cgpa is not None else None,
        'department': profile.department if profile and profile.department else None,
        'skills': profile.skills if profile and profile.skills else [],
        'graduation_year': profile.graduation_year if profile and profile.graduation_year else None,
        'preferred_roles': profile.preferred_roles if profile and profile.preferred_roles else [],
        'preferred_locations': profile.preferred_locations if profile and profile.preferred_locations else []
    }
    result = compute_eligibility(student_data, {
        'min_cgpa': job.min_cgpa, 'eligible_departments': job.eligible_departments or [], 'required_skills': job.required_skills or [],
        'graduation_year': job.graduation_year
    })
    result['match_score'] = compute_match_score(student_data, {'required_skills': job.required_skills or [], 'title': job.title, 'location': job.location})

    existing = Application.query.filter_by(student_id=user.id, job_id=job.id).first()
    app_info = {
        'id': existing.id,
        'status': existing.status,
        'created_at': existing.created_at.isoformat() if existing.created_at else None,
        'interview_date': existing.interview_date.isoformat() if getattr(existing, 'interview_date', None) else None
    } if existing else None

    return jsonify({'job_id': job.id, 'eligibility': result, 'application': app_info})

@blueprint.route('/applications', methods=['POST'])
@jwt_required()
def submit_application():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can apply.'}), 403
    data = request.get_json(silent=True) or {}
    job_id = data.get('job_id')
    if not job_id:
        return jsonify({'error': 'job_id is required.'}), 400
    job = Job.query.get_or_404(job_id)
    if job.status != 'Published':
        return jsonify({'error': 'This job is not open for applications.'}), 400
    profile = user.student_profile
    student_data = {
        'cgpa': profile.cgpa if profile else None,
        'department': profile.department if profile else None,
        'skills': profile.skills or [] if profile else [],
        'graduation_year': profile.graduation_year if profile else None
    }
    eligibility = compute_eligibility(student_data, {
        'min_cgpa': job.min_cgpa,
        'eligible_departments': job.eligible_departments or [],
        'required_skills': job.required_skills or [],
        'graduation_year': job.graduation_year
    })
    if not eligibility['eligible']:
        return jsonify({'error': 'You are not eligible for this job.', 'eligibility': eligibility}), 400
    existing = Application.query.filter_by(student_id=user.id, job_id=job.id).first()
    if existing:
        return jsonify({'error': 'Duplicate application detected.'}), 409
    application = Application(student_id=user.id, job_id=job.id, status='Applied', cover_note=data.get('cover_note'))
    db.session.add(application)
    db.session.add(Notification(
        user_id=user.id,
        title='Application submitted',
        message=f'Your application for {job.title} at {job.company.name} has been received.',
        kind='application',
        link=f'/jobs/{job.id}'
    ))
    if job.recruiter_id != user.id:
        db.session.add(Notification(
            user_id=job.recruiter_id,
            title='New job application',
            message=f'A student applied for {job.title}.',
            kind='application',
            link='/recruiter'
        ))
    db.session.commit()
    return jsonify({
        'message': 'Application submitted.',
        'application': {
            'id': application.id,
            'job_id': application.job_id,
            'status': application.status,
            'created_at': application.created_at.isoformat() if application.created_at else None
        }
    })

@blueprint.route('/applications', methods=['GET'])
@jwt_required()
def list_applications():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role == 'student':
        apps = Application.query.filter_by(student_id=user.id).order_by(Application.created_at.desc()).all()
    else:
        if user.role in {'officer', 'admin'}:
            apps = Application.query.order_by(Application.created_at.desc()).all()
        else:
            apps = Application.query.join(Job).filter(Job.recruiter_id == user.id).order_by(Application.created_at.desc()).all()
    results = []
    for a in apps:
        student_prof = a.student.student_profile
        feedback_list = [f.to_dict() for f in getattr(a, 'feedbacks', [])]
        results.append({
            'id': a.id,
            'job_id': a.job_id,
            'job_title': a.job.title if a.job else 'Job',
            'company_name': a.job.company.name if a.job and a.job.company else 'Company',
            'status': a.status,
            'student_id': a.student_id,
            'student_name': f'{student_prof.first_name} {student_prof.last_name}' if student_prof else a.student.email,
            'student_email': a.student.email,
            'department': student_prof.department if student_prof else None,
            'cgpa': student_prof.cgpa if student_prof else None,
            'skills': student_prof.skills if student_prof else [],
            'interview_date': a.interview_date.isoformat() if getattr(a, 'interview_date', None) else None,
            'cover_note': a.cover_note,
            'feedbacks': feedback_list,
            'created_at': a.created_at.isoformat() if a.created_at else None
        })
    return jsonify({'applications': results})

@blueprint.route('/applications/<int:app_id>/status', methods=['PATCH'])
@jwt_required()
def update_application_status(app_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role not in {'recruiter', 'officer', 'admin'}:
        return jsonify({'error': 'Only recruiters and officers can update application status.'}), 403
    app = Application.query.get_or_404(app_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'status is required.'}), 400
    if user.role == 'recruiter' and app.job.recruiter_id != user.id:
        return jsonify({'error': 'Access denied to another recruiter job application.'}), 403
    if new_status not in {'Applied', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'Rejected'}:
        return jsonify({'error': 'Unsupported application status.'}), 400
    app.status = new_status

    # Support interview date scheduling
    interview_date_str = data.get('interview_date')
    if interview_date_str:
        try:
            app.interview_date = datetime.fromisoformat(interview_date_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            pass

    # Support recruiter feedback (Feature 6: Recruiter Feedback-to-Improvement Loop)
    from backend.models import ApplicationFeedback
    feedback_data = data.get('feedback')
    saved_feedback = None
    if isinstance(feedback_data, dict) and (feedback_data.get('strengths') or feedback_data.get('gaps') or feedback_data.get('recommendations')):
        fb = ApplicationFeedback(
            application_id=app.id,
            recruiter_id=user.id,
            stage=feedback_data.get('stage', new_status),
            strengths=feedback_data.get('strengths', ''),
            gaps=feedback_data.get('gaps', ''),
            recommendations=feedback_data.get('recommendations', '')
        )
        db.session.add(fb)
        saved_feedback = fb

    msg = f'Your application for {app.job.title} is now {new_status}.'
    if new_status == 'Interview' and getattr(app, 'interview_date', None):
        msg += f' Interview scheduled for {app.interview_date.strftime("%b %d, %Y %I:%M %p")}.'
    elif saved_feedback and saved_feedback.recommendations:
        msg += f' Recruiter note: {saved_feedback.recommendations[:100]}...'

    db.session.add(Notification(
        user_id=app.student_id,
        title='Application status updated',
        message=msg,
        kind='interview' if new_status == 'Interview' else 'application',
        link='/student'
    ))
    db.session.commit()
    return jsonify({
        'message': 'Application status updated.',
        'application': {
            'id': app.id,
            'status': app.status,
            'interview_date': app.interview_date.isoformat() if getattr(app, 'interview_date', None) else None,
            'feedback': saved_feedback.to_dict() if saved_feedback else None
        }
    })

@blueprint.route('/applications/<int:app_id>/feedback', methods=['GET'])
@jwt_required()
def get_application_feedback(app_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    app = Application.query.get_or_404(app_id)
    if user.role == 'student' and app.student_id != user.id:
        return jsonify({'error': 'Unauthorized to view feedback for this application.'}), 403
    if user.role == 'recruiter' and app.job.recruiter_id != user.id:
        return jsonify({'error': 'Unauthorized to view feedback for another recruiter job.'}), 403
    from backend.models import ApplicationFeedback
    feedbacks = ApplicationFeedback.query.filter_by(application_id=app.id).order_by(ApplicationFeedback.created_at.desc()).all()
    return jsonify({'feedbacks': [f.to_dict() for f in feedbacks]})

