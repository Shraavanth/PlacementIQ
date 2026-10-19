from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import Resume, User

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

    from backend.models import InterviewAttempt, Resume, RoadmapTask, SkillEvidence
    profile = user.student_profile
    resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    evidences = SkillEvidence.query.filter_by(user_id=user.id).all()
    interview_count = InterviewAttempt.query.filter_by(user_id=user.id).count()
    roadmap_tasks = RoadmapTask.query.filter_by(user_id=user.id).all()

    # Dimension 1: Academic & Eligibility Readiness (0 - 25 pts)
    academic_score = 0
    academic_factors = []
    if profile:
        if profile.cgpa and profile.cgpa >= 7.5:
            academic_score += 10
            academic_factors.append(f'Strong CGPA ({profile.cgpa}/10)')
        elif profile.cgpa:
            academic_score += 6
            academic_factors.append(f'CGPA ({profile.cgpa}/10) meets base criteria')
        else:
            academic_factors.append('CGPA missing in profile')

        if profile.department and profile.graduation_year:
            academic_score += 10
            academic_factors.append(f'Academic enrollment verified ({profile.department}, {profile.graduation_year})')
        else:
            academic_factors.append('Department or graduation year not specified')

        if profile.university and profile.degree:
            academic_score += 5
            academic_factors.append('Institution and degree details complete')
    else:
        academic_factors.append('Profile record missing')

    # Dimension 2: Technical & Skill Coverage Readiness (0 - 35 pts)
    tech_score = 0
    tech_factors = []
    student_skills = profile.skills or [] if profile else []
    if len(student_skills) >= 5:
        tech_score += 15
        tech_factors.append(f'{len(student_skills)} skills listed on profile')
    elif student_skills:
        tech_score += 8
        tech_factors.append(f'{len(student_skills)} skills listed (recommend at least 5)')
    else:
        tech_factors.append('No technical skills listed')

    verified_evidences = [e for e in evidences if e.tier in {'assessed', 'evidence_backed', 'verified'}]
    if len(verified_evidences) >= 3:
        tech_score += 20
        tech_factors.append(f'{len(verified_evidences)} skills verified through assessments or evidence')
    elif verified_evidences:
        tech_score += 10
        tech_factors.append(f'{len(verified_evidences)} skill(s) verified')
    else:
        tech_factors.append('No skills verified yet via quizzes or portfolio links')

    # Dimension 3: Experience & Project Portfolio Readiness (0 - 20 pts)
    exp_score = 0
    exp_factors = []
    projects = profile.projects or [] if profile else []
    internships = profile.internships or [] if profile else []
    certifications = profile.certifications or [] if profile else []

    if projects:
        exp_score += 10
        exp_factors.append(f'{len(projects)} technical project(s) recorded')
    else:
        exp_factors.append('No project work documented')

    if internships or certifications:
        exp_score += 10
        exp_factors.append('Internship or certification credentials present')
    else:
        exp_factors.append('No internships or industry certifications added yet')

    # Dimension 4: Practice & Preparation Readiness (0 - 20 pts)
    prep_score = 0
    prep_factors = []
    if resume and resume.status == 'processed':
        prep_score += 10
        prep_factors.append('Resume uploaded and verified by parser')
    elif resume:
        prep_score += 5
        prep_factors.append('Resume uploaded (review suggested)')
    else:
        prep_factors.append('Resume not yet uploaded')

    if interview_count >= 3:
        prep_score += 10
        prep_factors.append(f'{interview_count} mock interview attempts logged')
    elif interview_count >= 1:
        prep_score += 5
        prep_factors.append('1-2 interview practice attempts logged')
    else:
        prep_factors.append('No mock interview sessions completed')

    composite_score = min(100, academic_score + tech_score + exp_score + prep_score)

    # Readiness level classification
    if composite_score >= 80:
        level = 'Placement Ready'
        summary = 'Exceptional placement readiness across academics, verified technical skills, and preparation.'
    elif composite_score >= 60:
        level = 'Competitive'
        summary = 'Solid foundation. Prioritize skill verification and interview practice to maximize offer rates.'
    elif composite_score >= 40:
        level = 'Developing'
        summary = 'Active progress. Focus on building projects and completing missing profile fields.'
    else:
        level = 'Needs Foundation'
        summary = 'Early stage. Complete your profile, upload your resume, and begin core skill building.'

    return jsonify({
        'composite_score': composite_score,
        'readiness_level': level,
        'summary': summary,
        'dimensions': [
            {'name': 'Academic & Eligibility', 'score': round(academic_score * 100 / 25), 'weight': '25%', 'factors': academic_factors},
            {'name': 'Technical & Skill Coverage', 'score': round(tech_score * 100 / 35), 'weight': '35%', 'factors': tech_factors},
            {'name': 'Portfolio & Experience', 'score': round(exp_score * 100 / 20), 'weight': '20%', 'factors': exp_factors},
            {'name': 'Practice & Interview Preparedness', 'score': round(prep_score * 100 / 20), 'weight': '20%', 'factors': prep_factors}
        ],
        'completed_tasks_count': sum(1 for t in roadmap_tasks if t.completed),
        'total_tasks_count': len(roadmap_tasks),
        'methodology': 'Calculated via 4-dimensional evidence weights (Academics 25%, Technical Verification 35%, Projects 20%, Preparation 20%).'
    })


@blueprint.route('/what-if', methods=['POST'])
@jwt_required()
def what_if_simulation():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Simulation is available to students.'}), 403

    from backend.models import SkillEvidence
    data = request.get_json(silent=True) or {}
    added_skills = data.get('added_skills', [])
    simulated_cgpa = data.get('simulated_cgpa')
    has_project = bool(data.get('has_project', False))
    has_interview_practice = bool(data.get('has_interview_practice', False))

    profile = user.student_profile
    base_skills = list(profile.skills or []) if profile else []
    all_sim_skills = list(set([s.strip() for s in base_skills + added_skills if s.strip()]))

    # Compute baseline score
    sim_academic = 15 if (simulated_cgpa or (profile and profile.cgpa)) else 5
    sim_tech = min(35, len(all_sim_skills) * 4 + (15 if added_skills else 5))
    sim_exp = 18 if (has_project or (profile and profile.projects)) else 8
    sim_prep = 18 if (has_interview_practice or user.interview_attempts) else 8
    sim_score = min(100, sim_academic + sim_tech + sim_exp + sim_prep)

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
        'simulated_composite_score': sim_score,
        'skills_considered': all_sim_skills,
        'simulated_path_fits': sim_paths,
        'disclaimer': 'Hypothetical simulation based on prospective improvements. Does not alter official academic records or bypass mandatory eligibility requirements.'
    })


INITIAL_ROADMAP_TASKS = [
    {
        'timeframe': '7-day',
        'title': 'Verify Core Skill with Code Evidence',
        'description': 'Link a public GitHub repository or take a verified skill assessment for your top primary skill.',
        'priority': 'High',
        'estimated_effort': '2 hours',
        'completion_criteria': 'Skill tier upgraded to Evidence-Backed or Assessed on profile.',
        'reason': 'Verified skills rank higher in recruiter candidate screening.'
    },
    {
        'timeframe': '7-day',
        'title': 'Resume Target Alignment',
        'description': 'Run resume analysis against at least 2 published target jobs to identify exact skill gaps.',
        'priority': 'High',
        'estimated_effort': '1 hour',
        'completion_criteria': 'Identify and log missing skills for target roles.',
        'reason': 'Ensures your resume contains machine-readable skill keywords required by job descriptions.'
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

    # Seed initial tasks if none exist yet for this student
    if not tasks:
        for item in INITIAL_ROADMAP_TASKS:
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

