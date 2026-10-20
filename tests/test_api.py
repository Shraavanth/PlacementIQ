import os
import io

import pytest
import fitz
from backend.utils import compute_eligibility, extract_skills_from_text
from backend.app import create_app
from backend.extensions import db
from backend.config import TestingConfig


@pytest.fixture
def client():
    app = create_app(test_config=TestingConfig)
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()


def test_student_registration_and_login(client):
    res = client.post('/api/auth/register', json={
        'firstName': 'Alice', 'lastName': 'Brown', 'email': 'alice@example.com', 'password': 'Password123', 'role': 'student'
    })
    assert res.status_code == 201
    body = res.get_json()
    assert body['user']['email'] == 'alice@example.com'

    login = client.post('/api/auth/login', json={'email': 'alice@example.com', 'password': 'Password123'})
    assert login.status_code == 200
    assert 'token' in login.get_json()
    assert client.get('/api/student/profile', headers={'Authorization': f'Bearer {login.get_json()["token"]}'}).status_code == 200


def test_demo_job_opportunities_and_recruiter_postings(client):
    jobs = client.get('/api/jobs').get_json()['jobs']
    titles = {job['title'] for job in jobs}
    assert {
        'Data Analyst Intern',
        'Frontend Engineer Intern',
        'Backend Python Engineer',
        'Cloud & DevOps Associate',
        'Java Software Engineer',
        'Machine Learning Intern',
        'QA Automation Engineer',
        'Product Analyst'
    }.issubset(titles)

    login = client.post('/api/auth/login', json={
        'email': 'recruiter@demo.com',
        'password': 'Recruiter@123'
    })
    token = login.get_json()['token']
    dashboard = client.get(
        '/api/dashboard/recruiter',
        headers={'Authorization': f'Bearer {token}'}
    ).get_json()
    backend_job = next(job for job in dashboard['jobs'] if job['title'] == 'Backend Python Engineer')
    assert backend_job['company_name'] == 'CloudHarbor'
    assert 'Flask' in backend_job['required_skills']
    assert backend_job['openings'] == 2


def test_reject_invalid_email(client):
    res = client.post('/api/auth/register', json={'email': 'invalid-email', 'password': 'Password123', 'role': 'student'})
    assert res.status_code == 400
    assert 'Valid email' in res.get_json()['error']


def test_create_job_rejects_missing_data(client):
    reg = client.post('/api/auth/register', json={'firstName': 'R', 'lastName': 'M', 'email': 'recruiter@example.com', 'password': 'Password123', 'role': 'recruiter'})
    assert reg.status_code == 201
    token = client.post('/api/auth/login', json={'email': 'recruiter@example.com', 'password': 'Password123'}).get_json()['token']
    res = client.post('/api/jobs', json={'title': 'Software Engineer'}, headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 400


def test_eligibility_engine_marks_student_eligible(client):
    client.post('/api/auth/register', json={'firstName': 'A', 'lastName': 'B', 'email': 'student2@example.com', 'password': 'Password123', 'role': 'student'})
    token = client.post('/api/auth/login', json={'email': 'student2@example.com', 'password': 'Password123'}).get_json()['token']
    client.put('/api/student/profile', json={'first_name': 'A', 'last_name': 'B', 'department': 'CSE', 'cgpa': 8.7, 'skills': ['Python', 'SQL']}, headers={'Authorization': f'Bearer {token}'})
    recruiter_reg = client.post('/api/auth/register', json={'firstName': 'R', 'lastName': 'N', 'email': 'recruiter2@example.com', 'password': 'Password123', 'role': 'recruiter'})
    assert recruiter_reg.status_code == 201
    recruiter_token = client.post('/api/auth/login', json={'email': 'recruiter2@example.com', 'password': 'Password123'}).get_json()['token']
    job = client.post('/api/jobs', json={'title': 'Backend Engineer', 'description': 'Build APIs', 'company_name': 'Recruiter Two', 'required_skills': ['Python', 'SQL'], 'min_cgpa': 8.0, 'eligible_departments': ['CSE', 'IT'], 'deadline': '2027-01-01', 'status': 'Published'}, headers={'Authorization': f'Bearer {recruiter_token}'})
    job_id = job.get_json()['job']['id']
    result = client.get(f'/api/jobs/{job_id}/eligibility', headers={'Authorization': f'Bearer {token}'})
    assert result.status_code == 200
    assert result.get_json()['eligibility']['eligible'] is True


@pytest.mark.parametrize(('student_cgpa', 'minimum_cgpa', 'expected'), [
    (9.35, 7.0, True),
    (8.50, 8.00, True),
    (7.00, 7.00, True),
    (6.90, 7.00, False),
    (9.35, 9.50, False),
])
def test_cgpa_eligibility_uses_numeric_values_and_inclusive_cutoff(student_cgpa, minimum_cgpa, expected):
    result = compute_eligibility(
        {'cgpa': student_cgpa, 'skills': []},
        {'min_cgpa': minimum_cgpa, 'required_skills': ['Python']}
    )
    assert result['eligible'] is expected
    assert result['status'] == ('eligible' if expected else 'ineligible')
    assert result['missing_skills'] == ['Python']
    assert result['skill_match_percentage'] == 0


@pytest.mark.parametrize('cgpa', [None, '', 'unknown', 10.1, float('nan'), True])
def test_missing_or_invalid_cgpa_requires_profile_correction(cgpa):
    result = compute_eligibility({'cgpa': cgpa}, {'min_cgpa': 7.0})
    assert result['eligible'] is False
    assert result['status'] == 'profile_required'
    assert result['cgpa_status'] == 'missing'
    assert 'cgpa' in result['missing_data']
    assert 'below' not in result['reasons'][0].lower()


def test_eligible_student_with_skill_gaps_can_apply_and_backend_rechecks_cgpa(client):
    student = client.post('/api/auth/register', json={
        'firstName': 'Eligible', 'lastName': 'Candidate',
        'email': 'eligible-candidate@example.com', 'password': 'Password123', 'role': 'student'
    })
    assert student.status_code == 201
    student_token = client.post('/api/auth/login', json={
        'email': 'eligible-candidate@example.com', 'password': 'Password123'
    }).get_json()['token']
    student_auth = {'Authorization': f'Bearer {student_token}'}
    profile = client.put('/api/student/profile', json={
        'cgpa': '9.35', 'department': 'CSE', 'graduation_year': 2026, 'skills': ['Python', 'SQL']
    }, headers=student_auth)
    assert profile.status_code == 200
    assert profile.get_json()['profile']['cgpa'] == 9.35

    recruiter_token = client.post('/api/auth/login', json={
        'email': 'recruiter@demo.com', 'password': 'Recruiter@123'
    }).get_json()['token']
    job_response = client.post('/api/jobs', json={
        'title': 'Data Platform Engineer', 'description': 'Build data services.',
        'required_skills': ['Python', 'SQL', 'Java'], 'min_cgpa': '7.0',
        'eligible_departments': ['CSE']
    }, headers={'Authorization': f'Bearer {recruiter_token}'})
    assert job_response.status_code == 201
    job_id = job_response.get_json()['job']['id']

    listed = client.get('/api/jobs', headers=student_auth).get_json()['jobs']
    listed_job = next(job for job in listed if job['id'] == job_id)
    eligibility_response = client.get(f'/api/jobs/{job_id}/eligibility', headers=student_auth).get_json()['eligibility']
    assert listed_job['eligibility']['eligible'] is True
    assert eligibility_response['eligible'] is True
    assert eligibility_response['student_cgpa'] == 9.35
    assert eligibility_response['required_cgpa'] == 7.0
    assert eligibility_response['matched_skills'] == ['Python', 'SQL']
    assert eligibility_response['missing_skills'] == ['Java']
    assert eligibility_response['skill_match_percentage'] < 100

    application = client.post('/api/applications', json={'job_id': job_id}, headers=student_auth)
    assert application.status_code == 200
    assert application.get_json()['application']['status'] == 'Applied'
    assert client.post('/api/applications', json={'job_id': job_id}, headers=student_auth).status_code == 409

    client.put('/api/student/profile', json={'cgpa': 6.9}, headers=student_auth)
    rejected = client.post('/api/applications', json={'job_id': job_id}, headers=student_auth)
    assert rejected.status_code == 400
    assert rejected.get_json()['eligibility']['status'] == 'ineligible'


def test_missing_cgpa_is_reported_as_profile_required_by_api(client):
    client.post('/api/auth/register', json={
        'firstName': 'Incomplete', 'lastName': 'Candidate',
        'email': 'incomplete-candidate@example.com', 'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={
        'email': 'incomplete-candidate@example.com', 'password': 'Password123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}
    job = client.get('/api/jobs').get_json()['jobs'][0]

    listed_job = next(
        item for item in client.get('/api/jobs', headers=auth).get_json()['jobs']
        if item['id'] == job['id']
    )
    assert listed_job['eligibility']['status'] == 'profile_required'
    assert listed_job['eligibility']['student_cgpa'] is None
    checked = client.get(f'/api/jobs/{job["id"]}/eligibility', headers=auth).get_json()['eligibility']
    assert checked['status'] == 'profile_required'
    assert 'valid CGPA' in checked['reasons'][0]
    rejected = client.post('/api/applications', json={'job_id': job['id']}, headers=auth)
    assert rejected.status_code == 400
    assert rejected.get_json()['eligibility']['status'] == 'profile_required'
    assert 'correct your profile' in rejected.get_json()['error']


def test_resume_cgpa_requires_review_and_never_overwrites_existing_profile_cgpa(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    client.post('/api/auth/register', json={
        'firstName': 'Resume', 'lastName': 'Candidate',
        'email': 'resume-cgpa@example.com', 'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={
        'email': 'resume-cgpa@example.com', 'password': 'Password123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}
    client.put('/api/student/profile', json={'cgpa': 8.5}, headers=auth)

    document = fitz.open()
    document.new_page().insert_text((72, 72), 'CGPA: 9.35')
    content = document.tobytes()
    document.close()
    uploaded = client.post(
        '/api/resume/upload',
        data={'file': (io.BytesIO(content), 'resume.pdf')},
        headers=auth
    )
    assert uploaded.status_code == 200
    assert uploaded.get_json()['resume']['analysis']['profile_fields']['cgpa'] == 9.35
    assert client.get('/api/student/profile', headers=auth).get_json()['profile']['cgpa'] == 8.5

    autofill = client.put('/api/student/profile/autofill', json={
        'values': {'cgpa': 9.35}
    }, headers=auth)
    assert autofill.status_code == 200
    assert autofill.get_json()['preserved_fields'] == ['cgpa']
    assert autofill.get_json()['profile']['cgpa'] == 8.5


def test_resume_upload_and_analysis(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    res = client.post('/api/auth/register', json={'firstName': 'Dev', 'lastName': 'User', 'email': 'dev@example.com', 'password': 'Password123', 'role': 'student'})
    assert res.status_code == 201
    token = client.post('/api/auth/login', json={'email': 'dev@example.com', 'password': 'Password123'}).get_json()['token']
    pdf = 'sample_resume.pdf'
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), 'Education: B.Tech Computer Science. Skills: Python, SQL, JavaScript and MySQL')
    pdf_bytes = document.tobytes()
    document.close()
    with open(pdf, 'wb') as fh:
        fh.write(pdf_bytes)
    with open(pdf, 'rb') as fh:
        upload = client.post('/api/resume/upload', data={'file': (fh, 'resume.pdf')}, headers={'Authorization': f'Bearer {token}'})
    assert upload.status_code == 200
    body = upload.get_json()['resume']
    assert body['skills'] == ['JavaScript', 'MySQL', 'Python', 'SQL']
    assert body['analysis']['education'] == ['B.Tech']
    assert body['analysis']['text_extracted'] is True
    current = client.get('/api/resume/analysis', headers={'Authorization': f'Bearer {token}'})
    assert current.status_code == 200
    assert current.get_json()['analysis']['skills'] == body['skills']
    os.remove(pdf)
    invalid = client.post(
        '/api/resume/upload',
        data={'file': (io.BytesIO(b'not a PDF'), 'invalid.pdf')},
        headers={'Authorization': f'Bearer {token}'}
    )
    assert invalid.status_code == 400
    assert invalid.get_json()['error'] == 'The uploaded file is not a readable PDF.'


def test_resume_analysis_reports_job_skill_gaps(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    client.post('/api/auth/register', json={'firstName': 'Dev', 'lastName': 'User', 'email': 'gap@example.com', 'password': 'Password123', 'role': 'student'})
    student_token = client.post('/api/auth/login', json={'email': 'gap@example.com', 'password': 'Password123'}).get_json()['token']
    recruiter_token = client.post('/api/auth/login', json={'email': 'recruiter@demo.com', 'password': 'Recruiter@123'}).get_json()['token']
    job = client.post(
        '/api/jobs',
        json={'title': 'Cloud Developer', 'description': 'Cloud role', 'required_skills': ['Python', 'AWS']},
        headers={'Authorization': f'Bearer {recruiter_token}'}
    ).get_json()['job']
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), 'Python')
    content = pdf.tobytes()
    pdf.close()
    response = client.post(
        '/api/resume/upload',
        data={'file': (io.BytesIO(content), 'resume.pdf')},
        headers={'Authorization': f'Bearer {student_token}'}
    )
    assert response.status_code == 200
    report = client.get(
        f'/api/resume/analysis?job_id={job["id"]}',
        headers={'Authorization': f'Bearer {student_token}'}
    ).get_json()['analysis']
    assert report['missing_skills'] == ['AWS']
    assert 'AWS' in report['skill_gap_guidance'][0]


def test_student_profile_validation_and_complete_placement_workflow(client):
    register = client.post('/api/auth/register', json={
        'firstName': 'Case', 'lastName': 'Student', 'email': 'workflow@example.com',
        'password': 'Password123', 'role': 'student'
    })
    assert register.status_code == 201
    student_token = client.post('/api/auth/login', json={
        'email': 'workflow@example.com', 'password': 'Password123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {student_token}'}
    assert client.post('/api/auth/login', json={
        'email': 'workflow@example.com', 'password': 'WrongPassword'
    }).status_code == 401

    invalid_profile = client.put('/api/student/profile', json={'cgpa': 12}, headers=auth)
    assert invalid_profile.status_code == 400
    profile = client.put('/api/student/profile', json={
        'first_name': 'Case', 'last_name': 'Student', 'department': 'CSE',
        'graduation_year': 2026, 'cgpa': 8.7, 'skills': ['Python', 'SQL'],
        'preferred_roles': ['Cybersecurity'], 'projects': ['Network monitor']
    }, headers=auth)
    assert profile.status_code == 200
    assert profile.get_json()['profile']['cgpa'] == 8.7
    assert client.get('/api/student/profile', headers=auth).get_json()['profile']['skills'] == ['Python', 'SQL']

    recruiter_token = client.post('/api/auth/login', json={
        'email': 'recruiter@demo.com', 'password': 'Recruiter@123'
    }).get_json()['token']
    recruiter_auth = {'Authorization': f'Bearer {recruiter_token}'}
    missing_job = client.post('/api/jobs', json={
        'title': '  ', 'description': 'A description'
    }, headers=recruiter_auth)
    assert missing_job.status_code == 400
    posted = client.post('/api/jobs', json={
        'title': 'Security Analyst', 'description': 'Monitor networks.',
        'required_skills': ['python', 'SQL'], 'eligible_departments': ['CSE'],
        'min_cgpa': 8.0, 'graduation_year': 2026
    }, headers=recruiter_auth)
    assert posted.status_code == 201
    job_id = posted.get_json()['job']['id']
    assert any(item['id'] == job_id for item in client.get('/api/jobs').get_json()['jobs'])
    assert client.get(f'/api/jobs/{job_id}/eligibility', headers=auth).get_json()['eligibility']['eligible'] is True
    assert client.get('/api/jobs?search=%27%20OR%201%3D1%20--').get_json()['jobs'] == []

    client.put('/api/student/profile', json={'cgpa': 6.5}, headers=auth)
    ineligible = client.get(f'/api/jobs/{job_id}/eligibility', headers=auth).get_json()['eligibility']
    assert ineligible['eligible'] is False
    assert 'Your CGPA (6.5) is below the required cutoff (8).' in ineligible['reasons']
    rejected_apply = client.post('/api/applications', json={'job_id': job_id}, headers=auth)
    assert rejected_apply.status_code == 400
    client.put('/api/student/profile', json={'cgpa': 8.7}, headers=auth)

    guidance = client.get('/api/career/guidance', headers=auth)
    assert guidance.status_code == 200
    paths = guidance.get_json()['recommendations']
    assert any(path['title'] == 'Cybersecurity' and path['match_score'] > 0 for path in paths)

    application = client.post('/api/applications', json={'job_id': job_id}, headers=auth)
    assert application.status_code == 200
    application_id = application.get_json()['application']['id']
    duplicate = client.post('/api/applications', json={'job_id': job_id}, headers=auth)
    assert duplicate.status_code == 409
    student_notifications = client.get('/api/notifications', headers=auth).get_json()['notifications']
    notice = next(item for item in student_notifications if item['title'] == 'Application submitted')
    assert client.patch(f'/api/notifications/{notice["id"]}/read', headers=auth).status_code == 200

    assert client.patch(f'/api/applications/{application_id}/status', json={'status': 'Shortlisted'}, headers=recruiter_auth).status_code == 200
    notifications_after_status = client.get('/api/notifications', headers=auth).get_json()['notifications']
    assert any(item['title'] == 'Application status updated' for item in notifications_after_status)
    dashboard = client.get('/api/dashboard/student', headers=auth).get_json()
    assert dashboard['overview']['shortlisted'] == 1
    assert dashboard['applications'][0]['status'] == 'Shortlisted'

    other_student = client.post('/api/auth/register', json={
        'firstName': 'Other', 'lastName': 'Student', 'email': 'other@example.com',
        'password': 'Password123', 'role': 'student'
    })
    assert other_student.status_code == 201
    other_token = client.post('/api/auth/login', json={
        'email': 'other@example.com', 'password': 'Password123'
    }).get_json()['token']
    other_notices = client.get('/api/notifications', headers={'Authorization': f'Bearer {other_token}'}).get_json()['notifications']
    assert other_notices == []

    assert client.get('/api/student/profile', headers=recruiter_auth).status_code == 403
    from backend.models import AuditLog
    with client.application.app_context():
        assert AuditLog.query.filter_by(action='access_denied', entity_type='student_profile').count() == 1


def test_skill_extraction_matches_complete_skill_names():
    assert extract_skills_from_text('JavaScript and MySQL') == ['JavaScript', 'MySQL']


def test_readiness_twin_and_what_if_simulation(client):
    reg = client.post('/api/auth/register', json={
        'firstName': 'Twin', 'lastName': 'Tester', 'email': 'twin@example.com',
        'password': 'Password123', 'role': 'student'
    })
    assert reg.status_code == 201
    token = client.post('/api/auth/login', json={'email': 'twin@example.com', 'password': 'Password123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    # Profile setup
    client.put('/api/student/profile', json={
        'first_name': 'Twin', 'last_name': 'Tester', 'department': 'CSE', 'graduation_year': 2026,
        'cgpa': 8.5, 'skills': ['Python', 'SQL', 'Flask']
    }, headers=auth)

    # Readiness twin check
    res = client.get('/api/career/readiness-twin', headers=auth)
    assert res.status_code == 200
    twin_data = res.get_json()
    assert 'composite_score' in twin_data
    assert len(twin_data['dimensions']) == 4
    assert twin_data['composite_score'] > 0

    # What-if simulation
    sim = client.post('/api/career/what-if', json={
        'added_skills': ['React', 'AWS'],
        'has_project': True
    }, headers=auth)
    assert sim.status_code == 200
    sim_data = sim.get_json()
    assert sim_data['is_simulated'] is True
    assert sim_data['simulated_composite_score'] >= twin_data['composite_score']


def test_roadmap_tasks_persistence_and_toggle(client):
    client.post('/api/auth/register', json={
        'firstName': 'Roadmap', 'lastName': 'User', 'email': 'roadmap@example.com',
        'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={'email': 'roadmap@example.com', 'password': 'Password123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    tasks_res = client.get('/api/career/roadmap-tasks', headers=auth)
    assert tasks_res.status_code == 200
    tasks = tasks_res.get_json()['tasks']
    assert len(tasks) > 0
    task_id = tasks[0]['id']

    toggle_res = client.patch(f'/api/career/roadmap-tasks/{task_id}/toggle', headers=auth)
    assert toggle_res.status_code == 200
    assert toggle_res.get_json()['task']['completed'] is True


def test_skill_evidence_submission_and_quiz(client):
    client.post('/api/auth/register', json={
        'firstName': 'Evidence', 'lastName': 'User', 'email': 'evidence@example.com',
        'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={'email': 'evidence@example.com', 'password': 'Password123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    # Submit GitHub evidence
    ev_res = client.post('/api/student/skills/evidence', json={
        'skill_name': 'Python',
        'evidence_type': 'github',
        'evidence_url': 'https://github.com/example/python-project',
        'verification_notes': 'Full stack API with pytest suite'
    }, headers=auth)
    assert ev_res.status_code == 200
    assert ev_res.get_json()['evidence']['tier'] == 'evidence_submitted'
    assert client.get('/api/student/skills/evidence', headers=auth).get_json()['evidence'][0]['status'] == 'evidence_submitted'

    # Fetch quiz questions
    quiz_q = client.get('/api/student/skills/quiz/python', headers=auth)
    assert quiz_q.status_code == 200
    questions = quiz_q.get_json()['questions']
    assert len(questions) > 0

    # Submit quiz answers
    answers = [
        {'question_index': index, 'selected_option': question['options'].index(
            'dict' if question['id'] == 1 else 'O(1)' if question['id'] == 2 else 'yield'
        )}
        for index, question in enumerate(questions)
    ]
    quiz_sub = client.post('/api/student/skills/quiz/submit', json={
        'skill_name': 'Python',
        'answers': answers
    }, headers=auth)
    assert quiz_sub.status_code == 200
    assert quiz_sub.get_json()['passed'] is True
    assert quiz_sub.get_json()['tier'] == 'assessed'


def test_interview_practice_attempt_and_history(client):
    client.post('/api/auth/register', json={
        'firstName': 'Interview', 'lastName': 'Candidate', 'email': 'interview@example.com',
        'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={'email': 'interview@example.com', 'password': 'Password123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    questions_res = client.get('/api/career/interview/questions?role=Software+Development', headers=auth)
    assert questions_res.status_code == 200
    tech_questions = questions_res.get_json()['bank']['Technical']
    question_text = tech_questions[0]['question']

    # Submit structured answer
    attempt_res = client.post('/api/career/interview/attempt', json={
        'role_target': 'Software Development',
        'category': 'Technical',
        'question': question_text,
        'answer': 'To handle high write concurrency, we implement a connection pool with Redis caching for rate limiting and token bucket. We ensure transactions use optimistic locking and asynchronous message queues to maintain database consistency and performance.'
    }, headers=auth)
    assert attempt_res.status_code == 200
    body = attempt_res.get_json()
    assert body['attempt']['score'] > 50
    assert len(body['attempt']['feedback']['matched_concepts']) > 0

    history_res = client.get('/api/career/interview/history', headers=auth)
    assert history_res.status_code == 200
    assert history_res.get_json()['total_attempts'] == 1


def test_recruiter_feedback_on_application(client):
    # Setup student
    client.post('/api/auth/register', json={'firstName': 'FB', 'lastName': 'Student', 'email': 'fbstudent@example.com', 'password': 'Password123', 'role': 'student'})
    st_token = client.post('/api/auth/login', json={'email': 'fbstudent@example.com', 'password': 'Password123'}).get_json()['token']
    client.put('/api/student/profile', json={'first_name': 'FB', 'last_name': 'Student', 'department': 'CSE', 'cgpa': 8.5, 'skills': ['Python']}, headers={'Authorization': f'Bearer {st_token}'})

    # Setup recruiter
    client.post('/api/auth/register', json={'firstName': 'FB', 'lastName': 'Recruiter', 'email': 'fbrecruiter@example.com', 'password': 'Password123', 'role': 'recruiter'})
    rec_token = client.post('/api/auth/login', json={'email': 'fbrecruiter@example.com', 'password': 'Password123'}).get_json()['token']
    rec_auth = {'Authorization': f'Bearer {rec_token}'}

    job = client.post('/api/jobs', json={'title': 'Python Dev', 'description': 'Dev', 'company_name': 'Feedback Recruiter Co', 'required_skills': ['Python']}, headers=rec_auth).get_json()['job']
    app = client.post('/api/applications', json={'job_id': job['id']}, headers={'Authorization': f'Bearer {st_token}'}).get_json()['application']

    # Recruiter updates status with feedback
    update_res = client.patch(f'/api/applications/{app["id"]}/status', json={
        'status': 'Interview',
        'interview_date': '2026-11-15T10:00:00Z',
        'feedback': {
            'stage': 'Technical Assessment',
            'strengths': 'Solid Python fundamentals and clean syntax',
            'gaps': 'Needs stronger grasp of async programming',
            'recommendations': 'Review asyncio documentation and complete a concurrent programming project'
        }
    }, headers=rec_auth)
    assert update_res.status_code == 200

    # Retrieve feedback
    fb_res = client.get(f'/api/applications/{app["id"]}/feedback', headers={'Authorization': f'Bearer {st_token}'})
    assert fb_res.status_code == 200
    feedbacks = fb_res.get_json()['feedbacks']
    assert len(feedbacks) == 1
    assert 'Solid Python' in feedbacks[0]['strengths']


def test_placement_intelligence_and_deadlines(client):
    token = client.post('/api/auth/login', json={'email': 'officer@demo.com', 'password': 'Officer@123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    intel_res = client.get('/api/dashboard/intelligence', headers=auth)
    assert intel_res.status_code == 200
    assert 'frequent_skills' in intel_res.get_json()
    assert 'funnel' in intel_res.get_json()

    deadlines_res = client.get('/api/dashboard/deadlines', headers=auth)
    assert deadlines_res.status_code == 200
    assert 'deadlines' in deadlines_res.get_json()


def test_admin_dashboard_and_user_moderation(client):
    # Privileged roles are provisioned, never self-selected during registration.
    assert client.post('/api/auth/register', json={'email': 'sysadmin@example.com', 'password': 'Password123', 'role': 'admin'}).status_code == 403
    admin_token = client.post('/api/auth/login', json={'email': 'admin@demo.com', 'password': 'Admin@123'}).get_json()['token']
    admin_auth = {'Authorization': f'Bearer {admin_token}'}

    # Student should be forbidden from accessing admin dashboard
    student_reg = client.post('/api/auth/register', json={'firstName': 'Normal', 'lastName': 'Student', 'email': 'normalstudent@example.com', 'password': 'Password123', 'role': 'student'})
    assert student_reg.status_code == 201
    st_id = student_reg.get_json()['user']['id']
    st_token = client.post('/api/auth/login', json={'email': 'normalstudent@example.com', 'password': 'Password123'}).get_json()['token']
    assert client.get('/api/dashboard/admin', headers={'Authorization': f'Bearer {st_token}'}).status_code == 403

    # Admin access dashboard
    admin_dash = client.get('/api/dashboard/admin', headers=admin_auth)
    assert admin_dash.status_code == 200
    assert 'metrics' in admin_dash.get_json()

    # Admin suspends student user
    suspend = client.patch(f'/api/dashboard/admin/users/{st_id}/status', json={'status': 'suspended'}, headers=admin_auth)
    assert suspend.status_code == 200
    assert suspend.get_json()['user']['status'] == 'suspended'

    # Suspended user cannot login
    relogin = client.post('/api/auth/login', json={'email': 'normalstudent@example.com', 'password': 'Password123'})
    assert relogin.status_code == 403


def test_notifications_read_all_and_unread_count(client):
    reg = client.post('/api/auth/register', json={'firstName': 'Notice', 'lastName': 'User', 'email': 'notice@example.com', 'password': 'Password123', 'role': 'student'})
    assert reg.status_code == 201
    token = client.post('/api/auth/login', json={'email': 'notice@example.com', 'password': 'Password123'}).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    res = client.get('/api/notifications', headers=auth)
    assert res.status_code == 200
    assert 'unread_count' in res.get_json()

    read_all = client.patch('/api/notifications/read-all', headers=auth)
    assert read_all.status_code == 200
    res_after = client.get('/api/notifications', headers=auth)
    assert res_after.get_json()['unread_count'] == 0


def test_resume_is_persisted_and_clear_preserves_manually_sourced_data(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    registration = client.post('/api/auth/register', json={
        'firstName': 'Manual', 'lastName': 'Student', 'email': 'resume-clear@example.com',
        'password': 'Password123', 'role': 'student'
    })
    assert registration.status_code == 201
    token = client.post('/api/auth/login', json={
        'email': 'resume-clear@example.com', 'password': 'Password123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}
    client.put('/api/student/profile', json={
        'first_name': 'Manual', 'last_name': 'Student', 'department': 'CSE',
        'skills': []
    }, headers=auth)

    pdf = fitz.open()
    pdf.new_page().insert_text(
        (72, 72),
        'Name: Resume Name\nEmail: resume@example.com\nPhone: +1 555 123 4567\n'
        'University: Example University\nDegree: B.Tech\nCGPA: 8.5\nSkills: Python'
    )
    content = pdf.tobytes()
    pdf.close()
    upload = client.post(
        '/api/resume/upload',
        data={'file': (io.BytesIO(content), 'resume.pdf')},
        headers=auth
    )
    assert upload.status_code == 200
    resume_id = upload.get_json()['resume']['id']
    assert client.get('/api/student/profile', headers=auth).get_json()['profile']['skills'] == []

    refreshed_token = client.post('/api/auth/login', json={
        'email': 'resume-clear@example.com', 'password': 'Password123'
    }).get_json()['token']
    refreshed_auth = {'Authorization': f'Bearer {refreshed_token}'}
    saved = client.get('/api/resume/analysis', headers=refreshed_auth).get_json()
    assert saved['resume']['filename'] == 'resume.pdf'
    assert saved['analysis']['skills'] == ['Python']
    assert client.get(saved['resume']['file_url'], headers=refreshed_auth).status_code == 200
    from backend.models import Resume
    with client.application.app_context():
        stored_path = Resume.query.filter_by(user_id=registration.get_json()['user']['id']).one().file_path
    assert os.path.exists(stored_path)

    autofill = client.put('/api/student/profile/autofill', json={
        'values': {'first_name': 'Resume', 'skills': ['Python']}
    }, headers=auth)
    assert autofill.status_code == 200
    evidence = client.post('/api/student/skills/evidence', json={
        'skill_name': 'SQL',
        'evidence_type': 'github',
        'evidence_url': 'https://github.com/example/sql-project'
    }, headers=auth)
    assert evidence.status_code == 200

    clear = client.delete('/api/resume', headers=auth)
    assert clear.status_code == 200
    profile = client.get('/api/student/profile', headers=auth).get_json()['profile']
    assert profile['first_name'] == ''
    assert profile['department'] == 'CSE'
    assert profile['skills'] == ['SQL']
    assert client.get('/api/resume/analysis', headers=auth).get_json()['resume'] is None
    assert not os.path.exists(stored_path)


def test_officer_student_counts_are_database_authoritative(client):
    student = client.post('/api/auth/register', json={
        'firstName': 'Counted', 'lastName': 'Student', 'email': 'counted@example.com',
        'password': 'Password123', 'role': 'student'
    })
    assert student.status_code == 201
    assert client.post('/api/auth/register', json={
        'firstName': 'Not', 'lastName': 'Officer', 'email': 'not-officer@example.com',
        'password': 'Password123', 'role': 'officer'
    }).status_code == 403
    token = client.post('/api/auth/login', json={
        'email': 'officer@demo.com', 'password': 'Officer@123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    dashboard_count = client.get('/api/dashboard/officer', headers=auth).get_json()['statistics']['students']
    intelligence_count = client.get('/api/dashboard/intelligence', headers=auth).get_json()['dataset_size']['students']
    assert dashboard_count == intelligence_count
    second_client = client.application.test_client()
    assert second_client.get('/api/dashboard/officer', headers=auth).get_json()['statistics']['students'] == dashboard_count


def test_readiness_and_what_if_share_a_single_score_model(client):
    client.post('/api/auth/register', json={
        'firstName': 'Twin', 'lastName': 'Consistent', 'email': 'twin-score@example.com',
        'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={
        'email': 'twin-score@example.com', 'password': 'Password123'
    }).get_json()['token']
    auth = {'Authorization': f'Bearer {token}'}

    current = client.get('/api/career/readiness-twin', headers=auth).get_json()
    simulation = client.post('/api/career/what-if', json={
        'added_skills': [], 'has_project': False, 'simulated_cgpa': None
    }, headers=auth).get_json()
    assert simulation['current_score'] == current['composite_score']
    assert simulation['simulated_score'] == current['composite_score']
    assert current['job_analyses']


def test_recruiters_can_manage_only_their_own_requisitions(client):
    recruiter_token = client.post('/api/auth/login', json={
        'email': 'recruiter@demo.com', 'password': 'Recruiter@123'
    }).get_json()['token']
    recruiter_auth = {'Authorization': f'Bearer {recruiter_token}'}
    recruiter_jobs = client.get('/api/dashboard/recruiter', headers=recruiter_auth).get_json()['jobs']
    target = recruiter_jobs[0]
    changed = client.patch(f'/api/jobs/{target["id"]}', json={'status': 'Closed'}, headers=recruiter_auth)
    assert changed.status_code == 200
    assert changed.get_json()['job']['status'] == 'Closed'
    assert all(job['id'] != target['id'] for job in client.get('/api/jobs').get_json()['jobs'])

    client.post('/api/auth/register', json={
        'firstName': 'Other', 'lastName': 'Recruiter', 'email': 'other-recruiter@example.com',
        'password': 'Password123', 'role': 'recruiter'
    })
    other_token = client.post('/api/auth/login', json={
        'email': 'other-recruiter@example.com', 'password': 'Password123'
    }).get_json()['token']
    denied = client.patch(f'/api/jobs/{target["id"]}', json={'status': 'Archived'}, headers={'Authorization': f'Bearer {other_token}'})
    assert denied.status_code == 404
