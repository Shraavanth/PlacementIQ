from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import AuditLog, StudentProfile, User
from backend.utils import normalize_cgpa
try:
    from backend.departments import normalize_department
except ImportError:
    from departments import normalize_department
from urllib.parse import urlparse

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
    if 'cgpa' in data:
        if data['cgpa'] is None or (isinstance(data['cgpa'], str) and not data['cgpa'].strip()):
            data['cgpa'] = None
        else:
            cgpa = normalize_cgpa(data['cgpa'])
            if cgpa is None:
                return jsonify({'error': 'CGPA must be a valid number between 0 and 10.'}), 400
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
    sources = dict(profile.field_sources or {})
    for field in fields:
        if field in data:
            setattr(profile, field, data[field])
            sources[field] = 'manual'
    profile.field_sources = sources
    db.session.add(profile)
    db.session.commit()
    return jsonify({'message': 'Profile updated.', 'profile': profile.to_dict()})


@blueprint.route('/profile/autofill', methods=['PUT'])
@jwt_required()
def apply_resume_autofill():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can update their profile.'}), 403

    data = request.get_json(silent=True) or {}
    values = data.get('values')
    if not isinstance(values, dict) or not values:
        return jsonify({'error': 'Select at least one extracted profile field.'}), 400

    allowed_fields = {
        'first_name', 'last_name', 'phone', 'university', 'degree', 'department',
        'graduation_year', 'cgpa', 'skills', 'certifications', 'projects', 'internships'
    }
    if any(field not in allowed_fields for field in values):
        return jsonify({'error': 'One or more selected profile fields are unsupported.'}), 400

    profile = user.student_profile
    if not profile:
        profile = StudentProfile(user_id=user.id, first_name='Student', last_name='User')
        db.session.add(profile)

    sources = dict(profile.field_sources or {})
    preserved_fields = []
    for field, value in values.items():
        if field in {'skills', 'certifications', 'projects', 'internships'}:
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                return jsonify({'error': f'{field.capitalize()} must be a list of strings.'}), 400
        elif field == 'department':
            if sources.get('department') == 'manual' and profile.department:
                preserved_fields.append(field)
                continue
            if not isinstance(value, str):
                return jsonify({'error': 'Department must be text.'}), 400
            value = normalize_department(value)
        elif field in {'graduation_year', 'cgpa'}:
            if field == 'cgpa' and profile.cgpa is not None:
                preserved_fields.append(field)
                continue
            if field == 'graduation_year' and sources.get('graduation_year') == 'manual' and profile.graduation_year is not None:
                preserved_fields.append(field)
                continue
            if field == 'cgpa':
                value = normalize_cgpa(value)
                if value is None:
                    return jsonify({'error': 'CGPA must be a valid number between 0 and 10.'}), 400
            elif value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))):
                return jsonify({'error': f'{field.replace("_", " ").capitalize()} must be numeric.'}), 400
            if field == 'graduation_year' and value is not None and not 1900 <= int(value) <= 2200:
                return jsonify({'error': 'Graduation year must be a valid year.'}), 400
        elif not isinstance(value, str):
            return jsonify({'error': f'{field.replace("_", " ").capitalize()} must be text.'}), 400
        setattr(profile, field, value)
        sources[field] = {'resume': list(value), 'manual': []} if isinstance(value, list) else 'resume'

    profile.field_sources = sources
    db.session.commit()
    message = 'Selected resume information applied.'
    if preserved_fields:
        message += f' Existing verified profile information ({", ".join(preserved_fields)}) was preserved; edit it in your profile if you intend to change it.'
    return jsonify({'message': message, 'profile': profile.to_dict(), 'preserved_fields': preserved_fields})


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
    if user.role != 'student' or target_user_id != user.id:
        return jsonify({'error': 'Students can only view their own skill evidence.'}), 403

    from backend.models import SkillEvidence
    evidences = SkillEvidence.query.filter_by(user_id=target_user_id).all()
    ev_map = {e.skill_name.casefold(): e.to_dict() for e in evidences}

    target_user = User.query.get_or_404(target_user_id)
    profile_skills = target_user.student_profile.skills if target_user.student_profile else []
    from backend.models import Resume
    resume = Resume.query.filter_by(user_id=target_user_id).order_by(Resume.created_at.desc()).first()
    resume_skills = resume.extracted_skills or [] if resume else []

    results = []
    all_skills = {}
    for skill in profile_skills:
        all_skills.setdefault(skill.casefold(), {'skill': skill, 'source': 'self_reported'})
    for skill in resume_skills:
        all_skills.setdefault(skill.casefold(), {'skill': skill, 'source': 'resume'})

    for skill_cf, item in all_skills.items():
        skill = item['skill']
        if skill_cf in ev_map:
            evidence = ev_map.pop(skill_cf)
            evidence['source'] = evidence.get('evidence_type') or 'evidence'
            evidence['status'] = 'assessment_completed' if evidence['tier'] == 'assessed' else 'evidence_submitted'
            results.append(evidence)
        else:
            results.append({
                'id': None,
                'user_id': target_user_id,
                'skill_name': skill,
                'tier': 'extracted_from_resume' if item['source'] == 'resume' else 'self_reported',
                'status': item['source'],
                'source': item['source'],
                'evidence_type': None,
                'evidence_url': None,
                'verification_notes': 'Mentioned in resume; this is not proof of practical proficiency.' if item['source'] == 'resume' else 'Added to profile; not yet verified with evidence or assessment.',
                'score': None,
                'created_at': None
            })
    for evidence in ev_map.values():
        evidence['source'] = evidence.get('evidence_type') or 'evidence'
        evidence['status'] = 'assessment_completed' if evidence['tier'] == 'assessed' else 'evidence_submitted'
        results.append(evidence)
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
    notes = (data.get('notes') or data.get('verification_notes') or '').strip()

    if not skill_name:
        return jsonify({'error': 'skill_name is required.'}), 400
    if not evidence_url:
        return jsonify({'error': 'evidence_url (e.g. GitHub repo link, project URL, or certificate ID) is required.'}), 400
    parsed_url = urlparse(evidence_url)
    if (
        evidence_type not in {'github', 'project_demo', 'certification'}
        or parsed_url.scheme not in {'https', 'http'}
        or not parsed_url.hostname
        or parsed_url.username
        or parsed_url.password
    ):
        return jsonify({'error': 'Choose a supported evidence type and provide a valid HTTP(S) evidence URL.'}), 400

    from backend.models import SkillEvidence
    existing = SkillEvidence.query.filter(
        SkillEvidence.user_id == user.id,
        db.func.lower(SkillEvidence.skill_name) == skill_name.casefold()
    ).first()

    if not existing:
        existing = SkillEvidence(
            user_id=user.id,
            skill_name=skill_name,
            tier='evidence_submitted',
            evidence_type=evidence_type,
            evidence_url=evidence_url,
            verification_notes=notes or f'Evidence submitted via {evidence_type}.'
        )
        db.session.add(existing)
    else:
        if existing.tier != 'assessed':
            existing.tier = 'evidence_submitted'
        existing.evidence_type = evidence_type
        existing.evidence_url = evidence_url
        existing.verification_notes = notes or f'Updated evidence via {evidence_type}.'

    # Ensure skill is present in profile skills
    if user.student_profile:
        current_skills = user.student_profile.skills or []
        if not any(s.casefold() == skill_name.casefold() for s in current_skills):
            user.student_profile.skills = current_skills + [skill_name]
            sources = dict(user.student_profile.field_sources or {})
            skills_source = sources.get('skills')
            if isinstance(skills_source, dict):
                manual_skills = list(skills_source.get('manual') or [])
                manual_skills.append(skill_name)
                skills_source['manual'] = manual_skills
                sources['skills'] = skills_source
            elif skills_source == 'resume':
                sources['skills'] = {'resume': list(current_skills), 'manual': [skill_name]}
            else:
                sources['skills'] = 'manual'
            user.student_profile.field_sources = sources

    db.session.commit()
    return jsonify({'message': f'Evidence for {skill_name} recorded successfully.', 'evidence': existing.to_dict()})


@blueprint.route('/skills/evidence/<int:evidence_id>', methods=['DELETE'])
@jwt_required()
def delete_skill_evidence(evidence_id):
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    if user.role != 'student':
        return jsonify({'error': 'Only students can remove skill evidence.'}), 403
    from backend.models import SkillEvidence
    evidence = SkillEvidence.query.filter_by(id=evidence_id, user_id=user.id).first_or_404()
    db.session.delete(evidence)
    db.session.commit()
    return jsonify({'message': 'Skill evidence removed.'})


@blueprint.route('/skills/quiz/<string:skill_name>', methods=['GET'])
@jwt_required()
def get_skill_quiz(skill_name):
    user = User.query.get_or_404(int(get_jwt_identity()))
    if user.role != 'student':
        return jsonify({'error': 'Only students can take skill assessments.'}), 403
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
    if not skill_name or not isinstance(answers, (dict, list)):
        return jsonify({'error': 'A skill name and quiz answers are required.'}), 400

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
    answer_map = answers
    if isinstance(answers, list):
        answer_map = {}
        for answer in answers:
            if not isinstance(answer, dict):
                return jsonify({'error': 'Quiz answers must contain question indexes and selected options.'}), 400
            try:
                question_index = int(answer['question_index'])
                selected_option = int(answer['selected_option'])
                selected_question = bank[question_index]
                selected_answer = selected_question['options'][selected_option]
            except (KeyError, TypeError, ValueError, IndexError):
                return jsonify({'error': 'One or more quiz answers are invalid.'}), 400
            answer_map[str(selected_question['id'])] = selected_answer
    for q in bank:
        user_ans = answer_map.get(str(q['id']), answer_map.get(q['id']))
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
        if passed:
            evidence.tier = 'assessed'
        elif evidence.tier in {'self_reported', 'extracted_from_resume'}:
            evidence.tier = 'self_reported'
        evidence.score = max(evidence.score or 0, score)
        evidence.verification_notes = f'Skill quiz assessment: scored {score}% ({correct_count}/{len(bank)} correct).'

    # Ensure skill is in student profile
    if user.student_profile:
        current_skills = user.student_profile.skills or []
        if not any(s.casefold() == skill_name.casefold() for s in current_skills):
            user.student_profile.skills = current_skills + [skill_name]
            sources = dict(user.student_profile.field_sources or {})
            skills_source = sources.get('skills')
            if isinstance(skills_source, dict):
                skills_source['manual'] = list(skills_source.get('manual') or []) + [skill_name]
                sources['skills'] = skills_source
            elif skills_source == 'resume':
                sources['skills'] = {'resume': list(current_skills), 'manual': [skill_name]}
            else:
                sources['skills'] = 'manual'
            user.student_profile.field_sources = sources

    db.session.commit()
    return jsonify({
        'skill_name': skill_name,
        'score': score,
        'passed': passed,
        'tier': evidence.tier,
        'correct_count': correct_count,
        'total_questions': len(bank),
        'notes': 'Assessment passed.' if passed else 'Assessment not passed. You can retake it after further practice.',
        'feedback': feedback_items
    })
