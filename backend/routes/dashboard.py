from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import Application, AuditLog, CareerRecommendation, Company, Job, Notification, StudentProfile, User
from backend.utils import compute_eligibility, compute_match_score

blueprint = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@blueprint.route('/student', methods=['GET'])
@jwt_required()
def student_dashboard():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can access this dashboard.'}), 403
    profile = user.student_profile
    student_data = {
        'cgpa': profile.cgpa if profile else None,
        'department': profile.department if profile else None,
        'skills': profile.skills or [] if profile else [],
        'graduation_year': profile.graduation_year if profile else None,
        'preferred_roles': profile.preferred_roles or [] if profile else [],
        'preferred_locations': profile.preferred_locations or [] if profile else []
    }
    published_jobs = Job.query.filter_by(status='Published').all()
    jobs = []
    eligible_count = 0
    now = datetime.utcnow()
    deadlines = []

    for job in published_jobs:
        eligibility_result = compute_eligibility(student_data, {
            'min_cgpa': job.min_cgpa, 'eligible_departments': job.eligible_departments or [],
            'required_skills': job.required_skills or [], 'graduation_year': job.graduation_year
        })
        eligible = eligibility_result['eligible']
        eligible_count += int(eligible)
        match_score = compute_match_score(student_data, {'required_skills': job.required_skills or [], 'title': job.title, 'location': job.location})

        if len(jobs) < 6:
            jobs.append({
                'id': job.id, 'title': job.title, 'company_name': job.company.name if job.company else 'Company',
                'location': job.location, 'required_skills': job.required_skills or [],
                'match_score': match_score, 'eligible': eligible,
                'reasons': eligibility_result['reasons'],
                'deadline': job.deadline.isoformat() if job.deadline else None
            })

        # Feature 7: Deadline Assistant detection for jobs
        if job.deadline:
            days_left = (job.deadline - now).days
            if 0 <= days_left <= 14:
                priority = 'High' if days_left <= 2 else 'Medium' if days_left <= 7 else 'Normal'
                deadlines.append({
                    'id': f'job-{job.id}',
                    'title': f'{job.title} at {job.company.name if job.company else "Company"}',
                    'category': 'Job Deadline',
                    'due_date': job.deadline.isoformat(),
                    'days_left': days_left,
                    'priority': priority,
                    'link': f'/jobs/{job.id}',
                    'action_label': 'Apply now' if eligible else 'View requirements'
                })

    recommendations = [
        {'id': r.id, 'title': r.title, 'reason': r.reason, 'skills': r.skills or []} for r in CareerRecommendation.query.filter_by(user_id=user.id).limit(3)
    ]
    if not recommendations:
        recommendations = [
            {'id': 1, 'title': 'Software Development', 'reason': 'Strong fit for Python, SQL and project-based development.', 'skills': ['Python', 'SQL', 'System Design']},
            {'id': 2, 'title': 'Data Analytics', 'reason': 'Excellent match for analytical and reporting skills.', 'skills': ['SQL', 'Tableau', 'Excel']}
        ]
    notifications = [{'id': n.id, 'title': n.title, 'message': n.message, 'kind': n.kind, 'link': n.link} for n in Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(5)]
    applications = Application.query.filter_by(student_id=user.id).order_by(Application.created_at.desc()).all()
    profile_fields = ['first_name', 'last_name', 'phone', 'university', 'degree', 'department', 'graduation_year', 'cgpa', 'skills', 'projects']
    profile_completion = round(sum(bool(getattr(profile, field)) for field in profile_fields) * 100 / len(profile_fields)) if profile else 0

    # Deadlines for upcoming interviews
    for app in applications:
        if app.status == 'Interview' and getattr(app, 'interview_date', None) and app.interview_date >= now:
            days_left = (app.interview_date - now).days
            deadlines.append({
                'id': f'interview-{app.id}',
                'title': f'Interview with {app.job.company.name if app.job and app.job.company else "Company"} for {app.job.title if app.job else "Role"}',
                'category': 'Scheduled Interview',
                'due_date': app.interview_date.isoformat(),
                'days_left': days_left,
                'priority': 'High' if days_left <= 3 else 'Medium',
                'link': '/career',
                'action_label': 'Practice interview'
            })

    # Missing profile information reminders
    if profile_completion < 80:
        missing_keys = [f.replace('_', ' ').capitalize() for f in profile_fields if not getattr(profile, f)]
        deadlines.append({
            'id': 'profile-completion',
            'title': f'Complete your profile ({profile_completion}% done)',
            'category': 'Profile Requirement',
            'due_date': None,
            'days_left': 0,
            'priority': 'High' if profile_completion < 50 else 'Medium',
            'link': '/student/profile',
            'action_label': 'Update profile'
        })

    overview = {
        'profileCompletion': profile_completion, 'eligibleJobs': eligible_count,
        'skillGaps': sum(1 for job in jobs if not job['eligible']),
        'totalApplications': len(applications),
        'applied': sum(application.status == 'Applied' for application in applications),
        'shortlisted': sum(application.status == 'Shortlisted' for application in applications),
        'interviews': sum(application.status == 'Interview' for application in applications),
        'hired': sum(application.status == 'Hired' for application in applications)
    }

    application_list = [{
        'id': application.id,
        'job_id': application.job_id,
        'job_title': application.job.title if application.job else 'Job',
        'company_name': application.job.company.name if application.job and application.job.company else 'Company',
        'status': application.status,
        'interview_date': application.interview_date.isoformat() if getattr(application, 'interview_date', None) else None,
        'feedbacks': [f.to_dict() for f in getattr(application, 'feedbacks', [])],
        'created_at': application.created_at.isoformat() if application.created_at else None
    } for application in applications]

    return jsonify({
        'profile': profile.to_dict() if profile else {},
        'jobs': jobs,
        'recommendations': recommendations,
        'notifications': notifications,
        'applications': application_list,
        'overview': overview,
        'deadlines': deadlines
    })

@blueprint.route('/recruiter', methods=['GET'])
@jwt_required()
def recruiter_dashboard():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'recruiter':
        return jsonify({'error': 'Only recruiters can access this dashboard.'}), 403
    jobs = Job.query.filter_by(recruiter_id=user.id).order_by(Job.created_at.desc()).limit(20).all()
    application_count = Application.query.join(Job).filter(Job.recruiter_id == user.id).count()
    return jsonify({
        'jobs': [{
            'id': j.id,
            'title': j.title,
            'company_name': j.company.name if j.company else 'Company',
            'location': j.location,
            'required_skills': j.required_skills or [],
            'min_cgpa': j.min_cgpa,
            'status': j.status,
            'deadline': j.deadline.isoformat() if j.deadline else None,
            'openings': j.openings
        } for j in jobs],
        'statistics': {'published_jobs': sum(j.status == 'Published' for j in jobs), 'applications': application_count, 'eligible_candidates': 0}
    })

@blueprint.route('/officer', methods=['GET'])
@jwt_required()
def officer_dashboard():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'officer':
        return jsonify({'error': 'Only placement officers can access this dashboard.'}), 403
    students = StudentProfile.query.count()
    hired = Application.query.filter_by(status='Hired').count()
    applications = Application.query.count()
    placement_rate = round(hired * 100 / applications) if applications else 0
    departments = [d[0] for d in db.session.query(StudentProfile.department).distinct().all() if d[0]]
    return jsonify({
        'statistics': {
            'students': students,
            'companies': Company.query.count(),
            'jobs': Job.query.count(),
            'placement_rate': f'{placement_rate}%'
        },
        'departments': departments,
        'summary': 'Statistics reflect the current institutional placement records.'
    })


@blueprint.route('/intelligence', methods=['GET'])
@jwt_required()
def placement_intelligence():
    # Feature 5: Placement Intelligence & Skill-Demand Forecasting
    published_jobs = Job.query.filter_by(status='Published').all()
    total_jobs = len(published_jobs)

    # Frequency analysis of required skills across published jobs
    skill_counts = {}
    role_distribution = {}
    for j in published_jobs:
        role_distribution[j.title] = role_distribution.get(j.title, 0) + (j.openings or 1)
        for s in (j.required_skills or []):
            skill_counts[s] = skill_counts.get(s, 0) + 1

    sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)
    frequent_skills = [{
        'skill': skill,
        'count': count,
        'percentage': round((count / max(total_jobs, 1)) * 100),
        'trend': 'High Demand' if count >= 2 else 'Moderate Demand'
    } for skill, count in sorted_skills]

    # Application funnel metrics
    total_applications = Application.query.count()
    shortlisted_count = Application.query.filter_by(status='Shortlisted').count()
    interview_count = Application.query.filter_by(status='Interview').count()
    hired_count = Application.query.filter_by(status='Hired').count()

    shortlist_rate = round((shortlisted_count / max(total_applications, 1)) * 100, 1)
    offer_rate = round((hired_count / max(shortlisted_count + interview_count + hired_count, 1)) * 100, 1)

    funnel = [
        {'stage': 'Total Applications', 'count': total_applications, 'conversion': '100%'},
        {'stage': 'Shortlisted', 'count': shortlisted_count, 'conversion': f'{shortlist_rate}%'},
        {'stage': 'Interview Round', 'count': interview_count, 'conversion': f'{round((interview_count / max(total_applications, 1)) * 100, 1)}%'},
        {'stage': 'Final Placement / Offer', 'count': hired_count, 'conversion': f'{offer_rate}%'}
    ]

    # Department breakdown
    dept_stats = []
    student_profiles = StudentProfile.query.all()
    for prof in student_profiles:
        if prof.department:
            # find or create
            found = next((d for d in dept_stats if d['department'] == prof.department), None)
            if not found:
                found = {'department': prof.department, 'total_students': 0, 'placed_students': 0}
                dept_stats.append(found)
            found['total_students'] += 1
            if Application.query.filter_by(student_id=prof.user_id, status='Hired').count() > 0:
                found['placed_students'] += 1

    for d in dept_stats:
        d['placement_rate'] = round((d['placed_students'] / max(d['total_students'], 1)) * 100)

    # Top learning recommendations derived from market demand
    learning_priorities = [
        {'skill': s['skill'], 'reason': f'Demanded in {s["percentage"]}% of published campus opportunities'}
        for s in frequent_skills[:5]
    ]

    is_sample_mode = total_jobs < 3
    return jsonify({
        'sample_mode': is_sample_mode,
        'dataset_size': {'jobs': total_jobs, 'applications': total_applications, 'students': len(student_profiles)},
        'frequent_skills': frequent_skills,
        'funnel': funnel,
        'department_trends': dept_stats,
        'learning_priorities': learning_priorities,
        'disclaimer': 'Descriptive institutional analytics based on current verified campus database records.'
    })


@blueprint.route('/deadlines', methods=['GET'])
@jwt_required()
def get_deadlines():
    # Feature 7: Smart Placement Deadline Assistant
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    now = datetime.utcnow()
    deadlines = []

    # 1. Active jobs with deadlines
    published_jobs = Job.query.filter_by(status='Published').all()
    for job in published_jobs:
        if job.deadline:
            days_left = (job.deadline - now).days
            if days_left >= 0:
                priority = 'High' if days_left <= 2 else 'Medium' if days_left <= 7 else 'Normal'
                deadlines.append({
                    'id': f'job-{job.id}',
                    'title': f'{job.title} — {job.company.name if job.company else "Company"}',
                    'category': 'Job Deadline',
                    'due_date': job.deadline.isoformat(),
                    'days_left': days_left,
                    'priority': priority,
                    'link': f'/jobs/{job.id}',
                    'action_label': 'Apply'
                })

    # 2. Upcoming interviews if student
    if user.role == 'student':
        apps = Application.query.filter_by(student_id=user.id).all()
        for app in apps:
            if app.status == 'Interview' and getattr(app, 'interview_date', None) and app.interview_date >= now:
                days_left = (app.interview_date - now).days
                deadlines.append({
                    'id': f'interview-{app.id}',
                    'title': f'Interview with {app.job.company.name if app.job and app.job.company else "Company"}',
                    'category': 'Interview Schedule',
                    'due_date': app.interview_date.isoformat(),
                    'days_left': days_left,
                    'priority': 'High' if days_left <= 2 else 'Medium',
                    'link': '/career',
                    'action_label': 'Practice'
                })

    deadlines.sort(key=lambda x: (0 if x['priority'] == 'High' else 1 if x['priority'] == 'Medium' else 2, x['days_left']))
    return jsonify({'deadlines': deadlines})


@blueprint.route('/admin', methods=['GET'])
@jwt_required()
def admin_dashboard():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'admin':
        return jsonify({'error': 'Only administrators can access this view.'}), 403

    users = User.query.order_by(User.created_at.desc()).all()
    jobs = Job.query.order_by(Job.created_at.desc()).all()
    applications = Application.query.order_by(Application.created_at.desc()).limit(20).all()
    audit_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(20).all()

    users_list = []
    for u in users:
        prof = u.student_profile
        rec = u.recruiter_profile
        name = f'{prof.first_name} {prof.last_name}' if prof else f'{rec.first_name} {rec.last_name}' if rec else u.email
        users_list.append({
            'id': u.id,
            'email': u.email,
            'name': name,
            'role': u.role,
            'status': u.status,
            'created_at': u.created_at.isoformat() if u.created_at else None
        })

    jobs_list = [{
        'id': j.id,
        'title': j.title,
        'company_name': j.company.name if j.company else 'Company',
        'status': j.status,
        'openings': j.openings,
        'applications_count': len(j.applications),
        'created_at': j.created_at.isoformat() if j.created_at else None
    } for j in jobs]

    return jsonify({
        'metrics': {
            'total_users': len(users),
            'students': sum(u.role == 'student' for u in users),
            'recruiters': sum(u.role == 'recruiter' for u in users),
            'officers': sum(u.role == 'officer' for u in users),
            'jobs': len(jobs),
            'published_jobs': sum(j.status == 'Published' for j in jobs),
            'total_applications': Application.query.count()
        },
        'users': users_list,
        'jobs': jobs_list,
        'recent_applications': [{
            'id': a.id,
            'job_title': a.job.title if a.job else 'Job',
            'student_email': a.student.email if a.student else 'User',
            'status': a.status,
            'created_at': a.created_at.isoformat() if a.created_at else None
        } for a in applications],
        'audit_logs': [{
            'id': log.id,
            'action': log.action,
            'entity_type': log.entity_type,
            'details': log.details,
            'user_email': log.user.email if log.user else 'User',
            'created_at': log.created_at.isoformat() if log.created_at else None
        } for log in audit_logs]
    })


@blueprint.route('/admin/users/<int:target_id>/status', methods=['PATCH'])
@jwt_required()
def update_user_status(target_id):
    user_id = int(get_jwt_identity())
    admin_user = User.query.get_or_404(user_id)
    if admin_user.role != 'admin':
        return jsonify({'error': 'Admin permissions required.'}), 403

    target_user = User.query.get_or_404(target_id)
    if target_user.id == admin_user.id:
        return jsonify({'error': 'Cannot alter your own admin status.'}), 400

    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in {'active', 'suspended'}:
        return jsonify({'error': 'Status must be active or suspended.'}), 400

    target_user.status = new_status
    db.session.add(AuditLog(
        user_id=admin_user.id,
        action='user_status_changed',
        entity_type='user',
        entity_id=target_user.id,
        details=f'User {target_user.email} status changed to {new_status}'
    ))
    db.session.commit()
    return jsonify({'message': f'User status set to {new_status}.', 'user': target_user.to_public_dict()})


@blueprint.route('/admin/jobs/<int:job_id>/status', methods=['PATCH'])
@jwt_required()
def update_job_status(job_id):
    user_id = int(get_jwt_identity())
    admin_user = User.query.get_or_404(user_id)
    if admin_user.role != 'admin':
        return jsonify({'error': 'Admin permissions required.'}), 403

    job = Job.query.get_or_404(job_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    if new_status not in {'Published', 'Draft', 'Closed'}:
        return jsonify({'error': 'Status must be Published, Draft, or Closed.'}), 400

    job.status = new_status
    db.session.add(AuditLog(
        user_id=admin_user.id,
        action='job_status_moderated',
        entity_type='job',
        entity_id=job.id,
        details=f'Job "{job.title}" status changed to {new_status}'
    ))
    db.session.commit()
    return jsonify({'message': f'Job status updated to {new_status}.', 'job_id': job.id, 'status': job.status})
