from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import Job, Resume, User
from backend.utils import compute_eligibility, compute_match_score

blueprint = Blueprint('career', __name__, url_prefix='/api/career')

CAREER_PATHS = [
    {
        'title': 'Software Development',
        'skills': ['Python', 'JavaScript', 'React', 'SQL', 'DSA'],
        'roadmap': ['Build and publish a full-stack project', 'Practice data structures and algorithms', 'Learn API design and testing']
    },
    {
        'title': 'Data Analytics',
        'skills': ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau'],
        'roadmap': ['Analyze a public dataset with SQL and Python', 'Build an interactive BI dashboard', 'Practice communicating data insights']
    },
    {
        'title': 'Cloud Engineering',
        'skills': ['AWS', 'Docker', 'Kubernetes', 'Linux', 'Python'],
        'roadmap': ['Deploy an application to a cloud provider', 'Containerize it with Docker', 'Learn cloud networking and infrastructure basics']
    },
    {
        'title': 'Cybersecurity',
        'skills': ['Networking', 'Linux', 'Python', 'AWS', 'SQL'],
        'roadmap': ['Learn networking and Linux fundamentals', 'Complete a safe security lab exercise', 'Study cloud security and incident response basics']
    }
]


def readiness_scores(user, added_skills=None, simulated_cgpa=None, has_project=False, has_interview_practice=False):
    from backend.models import InterviewAttempt, Resume, SkillEvidence

    profile = user.student_profile
    resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    evidences = SkillEvidence.query.filter_by(user_id=user.id).all()
    interview_count = InterviewAttempt.query.filter_by(user_id=user.id).count()
    extra_skills = added_skills or []

    academic_score = 0
    academic_factors = []
    cgpa = simulated_cgpa if simulated_cgpa is not None else (profile.cgpa if profile else None)
    if cgpa is not None:
        if cgpa >= 7.5:
            academic_score += 10
            academic_factors.append(f'Strong CGPA ({cgpa}/10)')
        else:
            academic_score += 6
            academic_factors.append(f'CGPA ({cgpa}/10) meets base criteria')
    else:
        academic_factors.append('CGPA missing in profile')
    if profile and profile.department and profile.graduation_year:
        academic_score += 10
        academic_factors.append(f'Academic details provided ({profile.department}, {profile.graduation_year})')
    else:
        academic_factors.append('Department or graduation year not specified')
    if profile and profile.university and profile.degree:
        academic_score += 5
        academic_factors.append('Institution and degree details complete')

    profile_skills = profile.skills or [] if profile else []
    resume_skills = resume.extracted_skills or [] if resume else []
    skills = {
        str(skill).casefold()
        for skill in profile_skills + resume_skills + extra_skills
        if isinstance(skill, str) and skill.strip()
    }
    tech_score = 15 if len(skills) >= 5 else 8 if skills else 0
    if skills:
        tech_factors = [f'{len(skills)} distinct skills listed or mentioned; resume mentions are unverified']
    else:
        tech_factors = ['No technical skills listed or extracted from a resume']
    assessed_count = sum(e.tier == 'assessed' for e in evidences)
    tech_score += 20 if assessed_count >= 3 else 10 if assessed_count else 0
    if assessed_count:
        tech_factors.append(f'{assessed_count} skills passed the in-app assessment')
    elif any(e.tier in {'evidence_submitted', 'evidence_backed'} for e in evidences):
        tech_factors.append('Evidence was submitted but has not been independently verified')
    else:
        tech_factors.append('No skills have passed an in-app assessment')

    projects = profile.projects or [] if profile else []
    resume_projects = ((resume.analysis or {}).get('profile_fields') or {}).get('projects', []) if resume else []
    internships = profile.internships or [] if profile else []
    certifications = profile.certifications or [] if profile else []
    documented_projects = {
        str(project).casefold()
        for project in list(projects or []) + list(resume_projects or [])
        if isinstance(project, str)
    }
    if documented_projects or has_project:
        exp_score = 10
        exp_factors = [f'{len(documented_projects) + int(has_project)} project(s) listed in the profile/resume or simulated; not independently verified']
    else:
        exp_score = 0
        exp_factors = ['No project work documented']
    if internships or certifications:
        exp_score += 10
        exp_factors.append('Internship or certification credentials present')
    else:
        exp_factors.append('No internships or industry certifications added yet')

    prep_score = 0
    prep_factors = []
    if resume and resume.status == 'processed':
        prep_score += 10
        prep_factors.append('Resume uploaded and analyzed')
    elif resume:
        prep_score += 5
        prep_factors.append('Resume uploaded (review suggested)')
    else:
        prep_factors.append('Resume not yet uploaded')
    if interview_count >= 3:
        prep_score += 10
        prep_factors.append(f'{interview_count} mock interview attempts logged')
    elif interview_count >= 1 or has_interview_practice:
        prep_score += 5
        prep_factors.append(f'{interview_count} mock interview practice attempt(s) logged or simulated')
    else:
        prep_factors.append('No mock interview sessions completed')

    dimensions = [
        {'name': 'Academic & Eligibility', 'score': round(academic_score * 100 / 25), 'weight': '25%', 'factors': academic_factors},
        {'name': 'Technical & Skill Coverage', 'score': round(tech_score * 100 / 35), 'weight': '35%', 'factors': tech_factors},
        {'name': 'Portfolio & Experience', 'score': round(exp_score * 100 / 20), 'weight': '20%', 'factors': exp_factors},
        {'name': 'Practice & Interview Preparedness', 'score': round(prep_score * 100 / 20), 'weight': '20%', 'factors': prep_factors}
    ]
    return {
        'score': min(100, academic_score + tech_score + exp_score + prep_score),
        'dimensions': dimensions,
        'skills': sorted(skills)
    }


@blueprint.route('/guidance', methods=['GET'])
@jwt_required()
def guidance():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Career guidance is available to students.'}), 403

    profile_skills = user.student_profile.skills if user.student_profile else []
    resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    skills = {str(skill).casefold(): str(skill) for skill in profile_skills or []}
    if resume:
        for skill in resume.extracted_skills or []:
            skills.setdefault(str(skill).casefold(), str(skill))

    paths = []
    for career in CAREER_PATHS:
        required = career['skills']
        matched = [skill for skill in required if skill.casefold() in skills]
        missing = [skill for skill in required if skill.casefold() not in skills]
        paths.append({
            'title': career['title'],
            'reason': f'{len(matched)} of {len(required)} recommended skills match your profile.',
            'skills': required,
            'matched_skills': matched,
            'missing_skills': missing,
            'roadmap': career['roadmap'],
            'match_score': round(100 * len(matched) / len(required))
        })
    paths.sort(key=lambda path: path['match_score'], reverse=True)
    return jsonify({'skills': sorted(skills.values()), 'recommendations': paths})


@blueprint.route('/readiness-twin', methods=['GET'])
@jwt_required()
def readiness_twin():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Readiness twin is available to students.'}), 403

    from backend.models import Application, RoadmapTask
    profile = user.student_profile
    roadmap_tasks = RoadmapTask.query.filter_by(user_id=user.id).all()
    readiness = readiness_scores(user)
    composite_score = readiness['score']
    profile_values = {
        'cgpa': profile.cgpa if profile else None,
        'department': profile.department if profile else None,
        'graduation_year': profile.graduation_year if profile else None,
        'skills': profile.skills or [] if profile else [],
        'university': profile.university if profile else None,
        'degree': profile.degree if profile else None,
        'preferred_roles': profile.preferred_roles or [] if profile else [],
        'preferred_locations': profile.preferred_locations or [] if profile else []
    }
    job_analyses = []
    for job in Job.query.filter_by(status='Published').order_by(Job.created_at.desc()).all():
        requirements = {
            'min_cgpa': job.min_cgpa,
            'eligible_departments': job.eligible_departments or [],
            'required_skills': job.required_skills or [],
            'graduation_year': job.graduation_year
        }
        eligibility = compute_eligibility(profile_values, requirements)
        job_analyses.append({
            'job_id': job.id,
            'title': job.title,
            'company_name': job.company.name if job.company else 'Company',
            'eligible': eligibility['eligible'],
            'eligibility_status': eligibility['status'],
            'eligibility_reasons': eligibility['reasons'],
            'student_cgpa': eligibility['student_cgpa'],
            'required_cgpa': eligibility['required_cgpa'],
            'skill_match_percentage': eligibility['skill_match_percentage'],
            'missing_data': eligibility['missing_data'],
            'missing_skills': eligibility['missing_skills'],
            'matched_skills': eligibility['matched_skills'],
            'match_score': compute_match_score(profile_values, {
                'required_skills': job.required_skills or [],
                'title': job.title,
                'location': job.location
            })
        })
    missing_profile_fields = [
        field for field in ('phone', 'university', 'degree', 'department', 'graduation_year', 'cgpa', 'skills')
        if not getattr(profile, field, None)
    ]
    application_outcomes = {
        status: Application.query.filter_by(student_id=user.id, status=status).count()
        for status in ('Applied', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'Rejected')
    }

    # Readiness level classification
    if composite_score >= 80:
        level = 'Placement Ready'
        summary = 'Strong score across the readiness dimensions shown below. Mandatory eligibility is evaluated separately for each job.'
    elif composite_score >= 60:
        level = 'Competitive'
        summary = 'A developing foundation. Use the dimension details and job-specific gaps to prioritize preparation.'
    elif composite_score >= 40:
        level = 'Developing'
        summary = 'Some preparation is recorded. Focus on building projects and completing the missing profile fields.'
    else:
        level = 'Needs Foundation'
        summary = 'The available profile shows preparation gaps. Complete your profile and begin a focused skills plan.'

    return jsonify({
        'composite_score': composite_score,
        'readiness_level': level,
        'summary': summary,
        'dimensions': readiness['dimensions'],
        'completed_tasks_count': sum(1 for t in roadmap_tasks if t.completed),
        'total_tasks_count': len(roadmap_tasks),
        'methodology': 'Calculated via four dimensions: academics (25%), profile skill coverage and passed in-app assessments (35%), documented projects and experience (20%), and resume analysis and interview practice (20%). Submitted links and resume mentions are not verification.',
        'missing_profile_fields': missing_profile_fields,
        'job_analyses': job_analyses,
        'application_outcomes': application_outcomes
    })


@blueprint.route('/what-if', methods=['POST'])
@jwt_required()
def what_if_simulation():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Simulation is available to students.'}), 403

    data = request.get_json(silent=True) or {}
    added_skills = data.get('added_skills', [])
    simulated_cgpa = data.get('simulated_cgpa')
    has_project = bool(data.get('has_project', False))
    has_interview_practice = bool(data.get('has_interview_practice', False))
    if not isinstance(added_skills, list) or not all(isinstance(skill, str) and skill.strip() for skill in added_skills):
        return jsonify({'error': 'added_skills must be a list of non-empty skill names.'}), 400
    if simulated_cgpa is not None:
        try:
            simulated_cgpa = float(simulated_cgpa)
        except (TypeError, ValueError):
            return jsonify({'error': 'Simulated CGPA must be a number between 0 and 10.'}), 400
        if not 0 <= simulated_cgpa <= 10:
            return jsonify({'error': 'Simulated CGPA must be a number between 0 and 10.'}), 400

    profile = user.student_profile
    base_skills = list(profile.skills or []) if profile else []
    all_sim_skills = sorted({skill.strip() for skill in base_skills + added_skills if skill.strip()})
    current_readiness = readiness_scores(user)
    simulated_readiness = readiness_scores(
        user,
        added_skills=added_skills,
        simulated_cgpa=simulated_cgpa,
        has_project=has_project,
        has_interview_practice=has_interview_practice
    )

    # Calculate match against target paths
    sim_paths = []
    for career in CAREER_PATHS:
        required = career['skills']
        sim_matched = [s for s in required if any(s.casefold() == sk.casefold() for sk in all_sim_skills)]
        sim_fit = round(100 * len(sim_matched) / len(required))
        sim_paths.append({
            'title': career['title'],
            'simulated_fit': sim_fit,
            'newly_unlocked_skills': [s for s in sim_matched if not any(s.casefold() == bs.casefold() for bs in base_skills)]
        })

    return jsonify({
        'is_simulated': True,
        'current_score': current_readiness['score'],
        'simulated_score': simulated_readiness['score'],
        'current_composite_score': current_readiness['score'],
        'simulated_composite_score': simulated_readiness['score'],
        'delta_points': simulated_readiness['score'] - current_readiness['score'],
        'simulated_dimensions': {
            'academic': simulated_readiness['dimensions'][0]['score'],
            'technical': simulated_readiness['dimensions'][1]['score'],
            'experience': simulated_readiness['dimensions'][2]['score'],
            'practice': simulated_readiness['dimensions'][3]['score']
        },
        'skills_considered': all_sim_skills,
        'simulated_path_fits': sim_paths,
        'disclaimer': 'Hypothetical simulation based on prospective improvements. Does not alter official academic records or bypass mandatory eligibility requirements.'
    })


INITIAL_ROADMAP_TASKS = [
    {
        'timeframe': '7-day',
        'title': 'Verify Core Skill with Code Evidence',
        'description': 'Add a project or GitHub link for review, or complete an available skill assessment.',
        'priority': 'High',
        'estimated_effort': '2 hours',
        'completion_criteria': 'Skill evidence is submitted or an available in-app assessment is completed.',
        'reason': 'Submitted evidence and assessment results help explain the skills listed in your profile.'
    },
    {
        'timeframe': '7-day',
        'title': 'Resume Target Alignment',
        'description': 'Compare your profile against published roles to identify required-skill and eligibility gaps.',
        'priority': 'High',
        'estimated_effort': '1 hour',
        'completion_criteria': 'Review the gaps for at least two published target roles.',
        'reason': 'Separates mandatory eligibility from general skill matching.'
    },
    {
        'timeframe': '30-day',
        'title': 'Build a Full-Stack or Analytical Capstone Project',
        'description': 'Develop a working project with clear documentation, tests, and a deployed live link.',
        'priority': 'High',
        'estimated_effort': '20 hours',
        'completion_criteria': 'Repository has README, architecture overview, and link.',
        'reason': 'Projects provide tangible proof of problem-solving ability in technical rounds.'
    },
    {
        'timeframe': '30-day',
        'title': 'Complete 3 Adaptive Mock Interview Sessions',
        'description': 'Practice structured answers using the STAR method for technical and behavioral questions.',
        'priority': 'Medium',
        'estimated_effort': '3 hours',
        'completion_criteria': 'Score at least 70% on technical and behavioral question evaluations.',
        'reason': 'Builds fluency and reduces anxiety in real recruitment drives.'
    },
    {
        'timeframe': '60-day',
        'title': 'Obtain an Industry-Recognized Cloud or Domain Certification',
        'description': 'Prepare for and achieve a baseline certification (e.g., AWS Cloud Practitioner, Azure, or specialized domain credential).',
        'priority': 'Medium',
        'estimated_effort': '30 hours',
        'completion_criteria': 'Add credential verification ID to profile certifications.',
        'reason': 'Differentiates candidate profile when competing for premium packages.'
    }
]


@blueprint.route('/roadmap-tasks', methods=['GET'])
@jwt_required()
def get_roadmap_tasks():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Roadmap tasks are for students.'}), 403

    from backend.models import RoadmapTask
    tasks = RoadmapTask.query.filter_by(user_id=user.id).order_by(RoadmapTask.created_at.asc()).all()

    if not tasks:
        initial_tasks = [dict(item) for item in INITIAL_ROADMAP_TASKS]
        profile = user.student_profile
        missing_profile_fields = [
            field.replace('_', ' ')
            for field in ('phone', 'university', 'degree', 'department', 'graduation_year', 'cgpa')
            if not getattr(profile, field, None)
        ]
        if missing_profile_fields:
            initial_tasks.insert(0, {
                'timeframe': '7-day',
                'title': 'Complete your placement profile',
                'description': f'Add the missing profile details: {", ".join(missing_profile_fields)}.',
                'priority': 'High',
                'estimated_effort': '1 hour',
                'completion_criteria': 'Save the missing academic and contact details in your profile.',
                'reason': 'Complete data is needed for accurate eligibility checks.'
            })

        listed_skills = {skill.casefold() for skill in (profile.skills or [])} if profile else set()
        published_skills = {
            skill for job in Job.query.filter_by(status='Published').all()
            for skill in (job.required_skills or [])
        }
        missing_skills = sorted(skill for skill in published_skills if skill.casefold() not in listed_skills)
        if missing_skills:
            skill_task = next((item for item in initial_tasks if item['title'] == 'Build a Full-Stack or Analytical Capstone Project'), None)
            if skill_task:
                skill_task['description'] = f'Build a documented project that demonstrates role-relevant skills: {", ".join(missing_skills[:5])}.'
                skill_task['reason'] = 'Project work can help address skills currently requested by published campus roles.'

        for item in initial_tasks:
            t = RoadmapTask(
                user_id=user.id,
                timeframe=item['timeframe'],
                title=item['title'],
                description=item['description'],
                priority=item['priority'],
                estimated_effort=item['estimated_effort'],
                completion_criteria=item['completion_criteria'],
                reason=item['reason'],
                completed=False
            )
            db.session.add(t)
        db.session.commit()
        tasks = RoadmapTask.query.filter_by(user_id=user.id).order_by(RoadmapTask.created_at.asc()).all()

    return jsonify({'tasks': [t.to_dict() for t in tasks]})


@blueprint.route('/roadmap-tasks/<int:task_id>/toggle', methods=['PATCH'])
@jwt_required()
def toggle_roadmap_task(task_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    from backend.models import Notification, RoadmapTask
    task = RoadmapTask.query.filter_by(id=task_id, user_id=user.id).first_or_404()
    task.completed = not task.completed
    from datetime import datetime
    task.completed_at = datetime.utcnow() if task.completed else None

    if task.completed:
        db.session.add(Notification(
            user_id=user.id,
            title='Roadmap milestone completed',
            message=f'Great progress! You completed "{task.title}". Your placement readiness score has increased.',
            kind='roadmap',
            link='/career'
        ))

    db.session.commit()
    return jsonify({'message': 'Task status updated.', 'task': task.to_dict()})


INTERVIEW_QUESTIONS = {
    'Software Development': {
        'Technical': [
            {
                'id': 'swe-tech-1',
                'question': 'How do you design a high-throughput REST API with rate limiting and database connection pooling?',
                'topic': 'System Design & APIs',
                'expected_concepts': ['connection pool', 'rate limiting', 'redis', 'caching', 'stateless', 'indexes', 'transactions', 'async'],
                'tips': 'Discuss database connection limits, Redis token bucket or leaky bucket for rate limiting, and cache invalidation.'
            },
            {
                'id': 'swe-tech-2',
                'question': 'Explain the difference between optimistic and pessimistic locking in relational database transactions.',
                'topic': 'Database Concurrency',
                'expected_concepts': ['lock', 'version', 'contention', 'commit', 'rollback', 'deadlock', 'isolation', 'concurrency'],
                'tips': 'Optimistic assumes rare conflicts using a version field; pessimistic locks rows immediately during read.'
            }
        ],
        'Behavioral': [
            {
                'id': 'swe-beh-1',
                'question': 'Tell me about a complex technical disagreement you had with a teammate and how you arrived at a solution.',
                'topic': 'Collaboration & Communication',
                'expected_concepts': ['situation', 'task', 'action', 'result', 'listen', 'trade-off', 'data', 'consensus'],
                'tips': 'Use the STAR format (Situation, Task, Action, Result) and focus on objective criteria over personal opinion.'
            }
        ]
    },
    'Data Analytics': {
        'Technical': [
            {
                'id': 'da-tech-1',
                'question': 'Explain the difference between a Star Schema and a Snowflake Schema in data warehousing.',
                'topic': 'Data Modeling',
                'expected_concepts': ['star schema', 'snowflake', 'dimension', 'fact', 'normalized', 'denormalized', 'performance', 'joins'],
                'tips': 'Star schemas denormalize dimensions for fast queries; Snowflake normalizes dimensions to save storage.'
            }
        ],
        'Behavioral': [
            {
                'id': 'da-beh-1',
                'question': 'Describe a scenario where data insights you produced changed an important business decision.',
                'topic': 'Data Storytelling',
                'expected_concepts': ['situation', 'task', 'action', 'result', 'metrics', 'dashboard', 'stakeholder', 'impact'],
                'tips': 'Highlight how you translated raw metrics into actionable business recommendations.'
            }
        ]
    },
    'Cloud Engineering': {
        'Technical': [
            {
                'id': 'cloud-tech-1',
                'question': 'How do you architect a zero-downtime deployment pipeline for containerized microservices?',
                'topic': 'Cloud Architecture',
                'expected_concepts': ['blue-green', 'canary', 'kubernetes', 'load balancer', 'health check', 'rollback', 'ci/cd', 'docker'],
                'tips': 'Mention blue/green or canary releases, automated health checks, and fast automated rollbacks.'
            }
        ],
        'Behavioral': [
            {
                'id': 'cloud-beh-1',
                'question': 'Describe how you diagnosed and resolved an unexpected production or infrastructure outage under time pressure.',
                'topic': 'Incident Management',
                'expected_concepts': ['situation', 'task', 'action', 'result', 'monitoring', 'logs', 'triage', 'postmortem'],
                'tips': 'Structure the answer around prompt triage, root cause identification, remediation, and preventative measures.'
            }
        ]
    }
}


@blueprint.route('/interview/questions', methods=['GET'])
@jwt_required()
def get_interview_questions():
    role_target = request.args.get('role', 'Software Development')
    questions = INTERVIEW_QUESTIONS.get(role_target) or INTERVIEW_QUESTIONS['Software Development']
    return jsonify({'role': role_target, 'bank': questions})


@blueprint.route('/interview/attempt', methods=['POST'])
@jwt_required()
def submit_interview_attempt():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Interview practice is available to students.'}), 403

    from backend.models import InterviewAttempt
    data = request.get_json(silent=True) or {}
    role_target = data.get('role_target', 'Software Development')
    category = data.get('category', 'Technical')
    question = (data.get('question') or '').strip()
    answer = (data.get('answer') or '').strip()

    if not question or not answer:
        return jsonify({'error': 'Question and answer are both required.'}), 400

    answer_lower = answer.lower()
    word_count = len(answer.split())

    # Find expected concepts if in question bank
    expected_concepts = []
    category_group = INTERVIEW_QUESTIONS.get(role_target, {}).get(category, [])
    for q in category_group:
        if q['question'].strip().lower() == question.lower():
            expected_concepts = q.get('expected_concepts', [])
            break

    if not expected_concepts:
        expected_concepts = ['architecture', 'design', 'performance', 'testing', 'scalability', 'security']

    matched_concepts = [c for c in expected_concepts if c.lower() in answer_lower]
    missing_concepts = [c for c in expected_concepts if c.lower() not in answer_lower]

    strengths = []
    improvements = []

    # Depth scoring (word count)
    if word_count >= 50:
        depth_score = 40
        strengths.append(f'Comprehensive answer with sufficient technical depth ({word_count} words).')
    elif word_count >= 25:
        depth_score = 30
        strengths.append(f'Good core technical explanation ({word_count} words).')
    else:
        depth_score = 15
        improvements.append('Answer is brief. Provide more elaboration and concrete examples.')

    # Concept coverage scoring
    if len(matched_concepts) >= 4:
        concept_score = 40
    else:
        concept_score = round((len(matched_concepts) / max(len(expected_concepts), 1)) * 40)

    if matched_concepts:
        strengths.append(f'Successfully incorporated key domain concepts: {", ".join(matched_concepts[:4])}.')
    if missing_concepts:
        improvements.append(f'Consider addressing these key topics in future answers: {", ".join(missing_concepts[:4])}.')

    # Structure scoring (STAR technique or technical trade-offs)
    structure_score = 10
    if category == 'Behavioral':
        star_markers = ['situation', 'task', 'action', 'result', 'outcome', 'learned', 'team']
        matched_star = [m for m in star_markers if m in answer_lower]
        structure_score = min(20, 10 + len(matched_star) * 3)
        if len(matched_star) >= 2:
            strengths.append('Follows structured STAR narrative (Situation, Task, Action, Result).')
        else:
            improvements.append('Explicitly structure behavioral answers around Situation, Task, Action, and Result.')
    else:
        trade_off_markers = ['trade-off', 'alternative', 'advantage', 'disadvantage', 'however', 'because', 'comparison', 'maintain', 'ensure']
        matched_tradeoffs = [m for m in trade_off_markers if m in answer_lower]
        structure_score = min(20, 10 + len(matched_tradeoffs) * 3)
        if matched_tradeoffs:
            strengths.append('Demonstrated analytical thinking by addressing trade-offs and architectural reasoning.')
        else:
            improvements.append('Discuss trade-offs between different approaches rather than just a single solution.')

    final_score = min(100, depth_score + concept_score + structure_score)

    feedback_payload = {
        'score': final_score,
        'word_count': word_count,
        'strengths': strengths,
        'improvements': improvements,
        'matched_concepts': matched_concepts,
        'missing_concepts': missing_concepts,
        'rubric_summary': f'Depth: {depth_score}/40 | Key Concepts: {concept_score}/40 | Structure: {structure_score}/20'
    }

    attempt = InterviewAttempt(
        user_id=user.id,
        role_target=role_target,
        category=category,
        question=question,
        answer=answer,
        score=final_score,
        feedback=feedback_payload
    )
    db.session.add(attempt)
    db.session.commit()

    return jsonify({
        'message': 'Answer evaluated successfully.',
        'attempt': attempt.to_dict()
    })


@blueprint.route('/interview/history', methods=['GET'])
@jwt_required()
def get_interview_history():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    from backend.models import InterviewAttempt
    attempts = InterviewAttempt.query.filter_by(user_id=user.id).order_by(InterviewAttempt.created_at.desc()).all()
    avg_score = round(sum(a.score for a in attempts) / len(attempts)) if attempts else 0
    return jsonify({
        'attempts': [a.to_dict() for a in attempts],
        'total_attempts': len(attempts),
        'average_score': avg_score
    })
