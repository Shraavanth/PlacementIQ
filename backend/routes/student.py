from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import AuditLog, StudentProfile, User

blueprint = Blueprint('student', __name__, url_prefix='/api/student')

@blueprint.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        db.session.add(AuditLog(
            user_id=user.id,
            action='access_denied',
            entity_type='student_profile',
            details='A non-student account attempted to access the student profile endpoint.'
        ))
        db.session.commit()
        return jsonify({'error': 'Only students can access this endpoint.'}), 403
    profile = user.student_profile
    if not profile:
        profile = StudentProfile(user_id=user.id, first_name='Student', last_name='User')
        db.session.add(profile)
        db.session.commit()
    return jsonify({'profile': profile.to_dict()})

@blueprint.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        db.session.add(AuditLog(
            user_id=user.id,
            action='access_denied',
            entity_type='student_profile',
            details='A non-student account attempted to update the student profile endpoint.'
        ))
        db.session.commit()
        return jsonify({'error': 'Only students can access this endpoint.'}), 403
    profile = user.student_profile or StudentProfile(user_id=user.id, first_name='Student', last_name='User')
    data = request.get_json(silent=True) or {}

    for field in ['first_name', 'last_name']:
        if field in data and (not isinstance(data[field], str) or not data[field].strip()):
            return jsonify({'error': f'{field.replace("_", " ").capitalize()} is required.'}), 400
    if 'cgpa' in data and data['cgpa'] is not None:
        try:
            cgpa = float(data['cgpa'])
        except (TypeError, ValueError):
            return jsonify({'error': 'CGPA must be a number between 0 and 10.'}), 400
        if not 0 <= cgpa <= 10:
            return jsonify({'error': 'CGPA must be a number between 0 and 10.'}), 400
        data['cgpa'] = cgpa
    if 'graduation_year' in data and data['graduation_year'] not in (None, ''):
        try:
            data['graduation_year'] = int(data['graduation_year'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Graduation year must be a valid year.'}), 400
        if not 1900 <= data['graduation_year'] <= 2200:
            return jsonify({'error': 'Graduation year must be a valid year.'}), 400

    list_fields = ['preferred_roles', 'preferred_locations', 'preferred_industries', 'skills', 'certifications', 'projects', 'internships']
    for field in list_fields:
        if field in data and not isinstance(data[field], list):
            return jsonify({'error': f'{field.replace("_", " ").capitalize()} must be a list.'}), 400

    fields = ['first_name', 'last_name', 'student_id', 'phone', 'university', 'degree', 'department', 'graduation_year', 'cgpa', *list_fields]
    for field in fields:
        if field in data:
            setattr(profile, field, data[field])
    db.session.add(profile)
    db.session.commit()
    return jsonify({'message': 'Profile updated.', 'profile': profile.to_dict()})


SKILL_QUIZ_BANK = {
    'python': [
        {
            'id': 1,
            'question': 'Which built-in Python data structure guarantees key insertion order in Python 3.7+?',
            'options': ['set', 'dict', 'tuple', 'frozenset'],
            'answer': 'dict',
            'explanation': 'In Python 3.7+, standard dict retains insertion order.'
        },
        {
            'id': 2,
            'question': 'What is the time complexity of looking up a key in an average Python dictionary?',
            'options': ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'],
            'answer': 'O(1)',
            'explanation': 'Python dicts are implemented using hash tables, giving average O(1) lookup.'
        },
        {
            'id': 3,
            'question': 'Which keyword is used to create a generator function in Python?',
            'options': ['return', 'yield', 'async', 'lambda'],
            'answer': 'yield',
            'explanation': 'A function with a yield statement becomes a generator.'
        }
    ],
    'sql': [
        {
            'id': 1,
            'question': 'Which clause is used to filter records after an aggregate function (e.g. GROUP BY)?',
            'options': ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'],
            'answer': 'HAVING',
            'explanation': 'HAVING filters aggregated groups, whereas WHERE filters individual rows prior to grouping.'
        },
        {
            'id': 2,
            'question': 'Which JOIN returns all rows from the left table and matched rows from the right table?',
            'options': ['INNER JOIN', 'RIGHT JOIN', 'LEFT JOIN', 'FULL OUTER JOIN'],
            'answer': 'LEFT JOIN',
            'explanation': 'LEFT JOIN returns all left rows with NULL for non-matching right rows.'
        },
        {
            'id': 3,
            'question': 'What is an index primarily used for in relational databases?',
            'options': ['Enforcing foreign keys', 'Speeding up data retrieval', 'Storing database backups', 'Encrypting passwords'],
            'answer': 'Speeding up data retrieval',
            'explanation': 'Indexes create balanced tree structures (like B-trees) for rapid row lookups.'
        }
    ],
    'react': [
        {
            'id': 1,
            'question': 'Which React hook should be used to manage side effects such as data fetching?',
            'options': ['useState', 'useContext', 'useEffect', 'useMemo'],
            'answer': 'useEffect',
            'explanation': 'useEffect executes after render and is designed for subscriptions, DOM mutations, and data fetching.'
        },
        {
            'id': 2,
            'question': 'Why should components in a list have a unique "key" prop?',
            'options': ['For CSS styling', 'To help React identify which items have changed, been added, or removed', 'To bind click events', 'To set element IDs'],
            'answer': 'To help React identify which items have changed, been added, or removed',
            'explanation': 'Keys give elements a stable identity across renders for efficient DOM reconciliation.'
        },
        {
            'id': 3,
            'question': 'What does React.useCallback return?',
            'options': ['A memoized value', 'A memoized callback function', 'A new state tuple', 'A DOM reference'],
            'answer': 'A memoized callback function',
            'explanation': 'useCallback returns a memoized version of the callback that only changes when dependencies change.'
        }
    ]
}


@blueprint.route('/skills/evidence', methods=['GET'])
@jwt_required()
def get_skill_evidence():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    target_user_id = request.args.get('user_id', type=int) or user.id
    if user.role == 'student' and target_user_id != user.id:
        return jsonify({'error': 'Unauthorized to view other students evidence.'}), 403

    from backend.models import SkillEvidence
    evidences = SkillEvidence.query.filter_by(user_id=target_user_id).all()
    ev_map = {e.skill_name.casefold(): e.to_dict() for e in evidences}

    target_user = User.query.get_or_404(target_user_id)
    profile_skills = target_user.student_profile.skills if target_user.student_profile else []

    results = []
    for skill in profile_skills:
        skill_cf = skill.casefold()
        if skill_cf in ev_map:
            results.append(ev_map[skill_cf])
        else:
            results.append({
                'id': None,
                'user_id': target_user_id,
                'skill_name': skill,
                'tier': 'self_reported',
                'evidence_type': None,
                'evidence_url': None,
                'verification_notes': 'Added to profile; not yet verified with evidence or assessment.',
                'score': None,
                'created_at': None
            })
    return jsonify({'evidence': results})


@blueprint.route('/skills/evidence', methods=['POST'])
@jwt_required()
def submit_skill_evidence():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can submit skill evidence.'}), 403

    data = request.get_json(silent=True) or {}
    skill_name = (data.get('skill_name') or '').strip()
    evidence_type = (data.get('evidence_type') or 'project').strip()
    evidence_url = (data.get('evidence_url') or '').strip()
    notes = (data.get('verification_notes') or '').strip()

    if not skill_name:
        return jsonify({'error': 'skill_name is required.'}), 400
    if not evidence_url:
        return jsonify({'error': 'evidence_url (e.g. GitHub repo link, project URL, or certificate ID) is required.'}), 400

    from backend.models import SkillEvidence
    existing = SkillEvidence.query.filter(
        SkillEvidence.user_id == user.id,
        db.func.lower(SkillEvidence.skill_name) == skill_name.casefold()
    ).first()

    if not existing:
        existing = SkillEvidence(
            user_id=user.id,
            skill_name=skill_name,
            tier='evidence_backed',
            evidence_type=evidence_type,
            evidence_url=evidence_url,
            verification_notes=notes or f'Evidence submitted via {evidence_type}.'
        )
        db.session.add(existing)
    else:
        existing.tier = 'evidence_backed'
        existing.evidence_type = evidence_type
        existing.evidence_url = evidence_url
        existing.verification_notes = notes or f'Updated evidence via {evidence_type}.'

    # Ensure skill is present in profile skills
    if user.student_profile:
        current_skills = user.student_profile.skills or []
        if not any(s.casefold() == skill_name.casefold() for s in current_skills):
            user.student_profile.skills = current_skills + [skill_name]

    db.session.commit()
    return jsonify({'message': f'Evidence for {skill_name} recorded successfully.', 'evidence': existing.to_dict()})


@blueprint.route('/skills/quiz/<string:skill_name>', methods=['GET'])
@jwt_required()
def get_skill_quiz(skill_name):
    skill_key = skill_name.strip().lower()
    questions = SKILL_QUIZ_BANK.get(skill_key)
    if not questions:
        # Generic technical questions for skills not explicitly in bank
        questions = [
            {
                'id': 1,
                'question': f'What is a primary best practice when developing a production application in {skill_name}?',
                'options': ['Writing clean modular code and automated tests', 'Ignoring error logging', 'Hardcoding secrets in source files', 'Avoiding documentation'],
                'answer': 'Writing clean modular code and automated tests',
                'explanation': f'Modular code and testing ensure {skill_name} reliability.'
            },
            {
                'id': 2,
                'question': f'How is performance optimization most effectively measured in {skill_name}?',
                'options': ['Guessing bottlenecks', 'Profiling and benchmark metrics', 'Increasing hardware without analysis', 'Removing all comments'],
                'answer': 'Profiling and benchmark metrics',
                'explanation': 'Profiling reveals real latency and memory bottlenecks.'
            }
        ]
    # Return questions without exposing answer key to client
    public_questions = [{
        'id': q['id'],
        'question': q['question'],
        'options': q['options']
    } for q in questions]
    return jsonify({'skill': skill_name, 'questions': public_questions})


@blueprint.route('/skills/quiz/submit', methods=['POST'])
@jwt_required()
def submit_skill_quiz():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can take skill assessments.'}), 403

    data = request.get_json(silent=True) or {}
    skill_name = (data.get('skill_name') or '').strip()
    answers = data.get('answers') or {}

    skill_key = skill_name.lower()
    bank = SKILL_QUIZ_BANK.get(skill_key) or [
        {
            'id': 1,
            'question': f'Best practice in {skill_name}',
            'answer': 'Writing clean modular code and automated tests'
        },
        {
            'id': 2,
            'question': f'Performance measurement in {skill_name}',
            'answer': 'Profiling and benchmark metrics'
        }
    ]

    correct_count = 0
    feedback_items = []
    for q in bank:
        user_ans = answers.get(str(q['id'])) or answers.get(q['id'])
        is_correct = (user_ans == q['answer'])
        if is_correct:
            correct_count += 1
        feedback_items.append({
            'question_id': q['id'],
            'correct': is_correct,
            'correct_answer': q['answer'],
            'explanation': q.get('explanation', '')
        })

    score = round((correct_count / len(bank)) * 100)
    passed = score >= 60

    from backend.models import SkillEvidence
    evidence = SkillEvidence.query.filter(
        SkillEvidence.user_id == user.id,
        db.func.lower(SkillEvidence.skill_name) == skill_name.casefold()
    ).first()

    if not evidence:
        evidence = SkillEvidence(
            user_id=user.id,
            skill_name=skill_name,
            tier='assessed' if passed else 'self_reported',
            evidence_type='quiz',
            score=score,
            verification_notes=f'Skill quiz assessment: scored {score}% ({correct_count}/{len(bank)} correct).'
        )
        db.session.add(evidence)
    else:
        if passed or evidence.tier == 'self_reported':
            evidence.tier = 'assessed' if passed else evidence.tier
        evidence.score = max(evidence.score or 0, score)
        evidence.verification_notes = f'Skill quiz assessment: scored {score}% ({correct_count}/{len(bank)} correct).'

    # Ensure skill is in student profile
    if user.student_profile:
        current_skills = user.student_profile.skills or []
        if not any(s.casefold() == skill_name.casefold() for s in current_skills):
            user.student_profile.skills = current_skills + [skill_name]

    db.session.commit()
    return jsonify({
        'skill_name': skill_name,
        'score': score,
        'passed': passed,
        'tier': evidence.tier,
        'feedback': feedback_items
    })

