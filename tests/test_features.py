import pytest
from backend.app import create_app
from backend.config import TestingConfig
from backend.extensions import db
from backend.models import User, Company, Job, StudentProfile, Application
from backend.utils import compute_eligibility, make_serialized_job
from backend.departments import normalize_department, departments_match, student_matches_any_department
from backend.routes.resume import extract_profile_fields


@pytest.fixture
def client():
    app = create_app(test_config=TestingConfig)
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()


# ==============================================================================
# PART 1 & 7.1: Graduation-Year Eligibility Mode Tests
# ==============================================================================

def test_graduation_year_mode_only_rule_2026():
    job = {
        'min_cgpa': 7.0,
        'eligible_departments': [],
        'required_skills': [],
        'graduation_year': 2026,
        'graduation_year_mode': 'Only'
    }

    # Student 2025 -> Fail
    res_2025 = compute_eligibility({'cgpa': 8.0, 'graduation_year': 2025}, job)
    assert res_2025['eligible'] is False
    assert res_2025['mandatory_breakdown']['graduation_year']['status'] == 'unmet'
    assert 'Graduation year must be 2026.' in res_2025['reasons']

    # Student 2026 -> Pass
    res_2026 = compute_eligibility({'cgpa': 8.0, 'graduation_year': 2026}, job)
    assert res_2026['eligible'] is True
    assert res_2026['mandatory_breakdown']['graduation_year']['status'] == 'met'

    # Student 2027 -> Fail
    res_2027 = compute_eligibility({'cgpa': 8.0, 'graduation_year': 2027}, job)
    assert res_2027['eligible'] is False
    assert res_2027['mandatory_breakdown']['graduation_year']['status'] == 'unmet'


def test_graduation_year_mode_na_rule_2026():
    job = {
        'min_cgpa': 7.0,
        'eligible_departments': [],
        'required_skills': [],
        'graduation_year': 2026,
        'graduation_year_mode': 'NA'
    }

    for year in [2022, 2023, 2024, 2025, 2026]:
        res = compute_eligibility({'cgpa': 8.0, 'graduation_year': year}, job)
        assert res['eligible'] is True, f"Year {year} should pass under NA mode"
        assert res['mandatory_breakdown']['graduation_year']['status'] == 'met'

    # Student 2027 -> Fail
    res_2027 = compute_eligibility({'cgpa': 8.0, 'graduation_year': 2027}, job)
    assert res_2027['eligible'] is False
    assert res_2027['mandatory_breakdown']['graduation_year']['status'] == 'unmet'
    assert 'Graduation year must be 2026 or earlier.' in res_2027['reasons']


def test_graduation_year_mode_different_configured_year():
    job = {
        'min_cgpa': 6.0,
        'graduation_year': 2024,
        'graduation_year_mode': 'NA'
    }
    # 2023 passes, 2024 passes, 2025 fails
    assert compute_eligibility({'cgpa': 7.0, 'graduation_year': 2023}, job)['eligible'] is True
    assert compute_eligibility({'cgpa': 7.0, 'graduation_year': 2024}, job)['eligible'] is True
    assert compute_eligibility({'cgpa': 7.0, 'graduation_year': 2025}, job)['eligible'] is False


def test_graduation_year_missing_and_backward_compatibility():
    # Existing job without graduation_year_mode defaults to 'Only'
    job_no_mode = {
        'min_cgpa': 6.0,
        'graduation_year': 2025
    }
    res_exact = compute_eligibility({'cgpa': 7.0, 'graduation_year': 2025}, job_no_mode)
    assert res_exact['eligible'] is True

    res_earlier = compute_eligibility({'cgpa': 7.0, 'graduation_year': 2024}, job_no_mode)
    assert res_earlier['eligible'] is False  # 'Only' behavior by default

    # Missing student graduation year
    res_missing = compute_eligibility({'cgpa': 7.0, 'graduation_year': None}, job_no_mode)
    assert res_missing['eligible'] is False
    assert 'graduation_year' in res_missing['missing_data']


def test_job_crud_graduation_year_mode_api(client):
    # Register recruiter
    rec_res = client.post('/api/auth/register', json={
        'firstName': 'Rec', 'lastName': 'Ruiter', 'email': 'rec@test.com', 'password': 'Password123', 'role': 'recruiter'
    })
    token = client.post('/api/auth/login', json={'email': 'rec@test.com', 'password': 'Password123'}).get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    # 1. Invalid mode -> 400
    bad_res = client.post('/api/jobs', headers=headers, json={
        'title': 'Test Job',
        'description': 'Description here',
        'company_name': 'Acme Corp',
        'graduation_year': 2026,
        'graduation_year_mode': 'INVALID'
    })
    assert bad_res.status_code == 400

    # 2. Valid mode 'NA' -> 201
    create_res = client.post('/api/jobs', headers=headers, json={
        'title': 'Software Engineer Requisition',
        'description': 'Core engineering role',
        'company_name': 'Acme Corp',
        'graduation_year': 2026,
        'graduation_year_mode': 'NA',
        'min_cgpa': 7.5,
        'eligible_departments': ['CSE', 'IT']
    })
    assert create_res.status_code == 201
    created_job = create_res.get_json()['job']
    job_id = created_job['id']
    assert created_job['graduation_year_mode'] == 'NA'
    assert created_job['graduation_year'] == 2026

    # 3. Reload job via GET /api/jobs/<id>
    get_res = client.get(f'/api/jobs/{job_id}')
    assert get_res.status_code == 200
    assert get_res.get_json()['job']['graduation_year_mode'] == 'NA'

    # 4. Update mode to 'Only' via PATCH
    patch_res = client.patch(f'/api/jobs/{job_id}', headers=headers, json={
        'graduation_year_mode': 'Only'
    })
    assert patch_res.status_code == 200
    assert patch_res.get_json()['job']['graduation_year_mode'] == 'Only'

    # Re-fetch to ensure persistence
    get_res2 = client.get(f'/api/jobs/{job_id}')
    assert get_res2.get_json()['job']['graduation_year_mode'] == 'Only'


def test_application_submission_enforces_graduation_year_mode(client):
    # Recruiter creates job with mode NA and graduation_year 2026
    client.post('/api/auth/register', json={
        'firstName': 'Rec2', 'lastName': 'Ruiter2', 'email': 'rec2@test.com', 'password': 'Password123', 'role': 'recruiter'
    })
    rec_token = client.post('/api/auth/login', json={'email': 'rec2@test.com', 'password': 'Password123'}).get_json()['token']
    job_res = client.post('/api/jobs', headers={'Authorization': f'Bearer {rec_token}'}, json={
        'title': 'Backend Developer',
        'description': 'Backend Python role',
        'company_name': 'TechHub',
        'min_cgpa': 7.0,
        'graduation_year': 2026,
        'graduation_year_mode': 'NA'
    })
    job_id = job_res.get_json()['job']['id']

    # Student 1 with graduation year 2024 (earlier year)
    client.post('/api/auth/register', json={
        'firstName': 'Stu', 'lastName': 'Early', 'email': 'stu_early@test.com', 'password': 'Password123', 'role': 'student'
    })
    stu1_token = client.post('/api/auth/login', json={'email': 'stu_early@test.com', 'password': 'Password123'}).get_json()['token']
    stu1_headers = {'Authorization': f'Bearer {stu1_token}'}
    client.put('/api/student/profile', headers=stu1_headers, json={
        'cgpa': 8.5,
        'graduation_year': 2024,
        'department': 'Computer Science and Engineering'
    })

    # Student 1 applies -> should pass under 'NA'
    app_res1 = client.post('/api/applications', headers=stu1_headers, json={'job_id': job_id})
    assert app_res1.status_code == 200

    # Student 2 with graduation year 2027 (future year)
    client.post('/api/auth/register', json={
        'firstName': 'Stu', 'lastName': 'Future', 'email': 'stu_future@test.com', 'password': 'Password123', 'role': 'student'
    })
    stu2_token = client.post('/api/auth/login', json={'email': 'stu_future@test.com', 'password': 'Password123'}).get_json()['token']
    stu2_headers = {'Authorization': f'Bearer {stu2_token}'}
    client.put('/api/student/profile', headers=stu2_headers, json={
        'cgpa': 8.5,
        'graduation_year': 2027,
        'department': 'Computer Science and Engineering'
    })

    # Student 2 applies -> should fail under 'NA' (must be 2026 or earlier)
    app_res2 = client.post('/api/applications', headers=stu2_headers, json={'job_id': job_id})
    assert app_res2.status_code == 400
    assert 'Graduation year must be 2026 or earlier.' in app_res2.get_json()['eligibility']['reasons']


# ==============================================================================
# PART 2 & 7.2: Centralized Department Normalization Tests
# ==============================================================================

def test_department_normalization_aliases():
    pairs = [
        ('CSE', 'Computer Science and Engineering'),
        ('Computer Science and Engineering', 'Computer Science and Engineering'),
        ('Computer Science', 'Computer Science and Engineering'),
        ('IT', 'Information Technology'),
        ('Information Technology', 'Information Technology'),
        ('ECE', 'Electronics and Communication Engineering'),
        ('Electronics and Communication Engineering', 'Electronics and Communication Engineering'),
        ('EEE', 'Electrical and Electronics Engineering'),
        ('Electrical and Electronics Engineering', 'Electrical and Electronics Engineering'),
        ('AI & DS', 'Artificial Intelligence and Data Science'),
        ('Artificial Intelligence and Data Science', 'Artificial Intelligence and Data Science'),
        ('AI & ML', 'Artificial Intelligence and Machine Learning'),
        ('Artificial Intelligence and Machine Learning', 'Artificial Intelligence and Machine Learning'),
        ('Mechanical Engineering', 'Mechanical Engineering'),
        ('Civil Engineering', 'Civil Engineering'),
        ('Data Science', 'Data Science'),
    ]
    for raw, canonical in pairs:
        assert normalize_department(raw) == canonical, f"Failed to normalize {raw} to {canonical}"


def test_departments_bidirectional_match():
    # Both directions match
    assert departments_match('CSE', 'Computer Science and Engineering')
    assert departments_match('Computer Science and Engineering', 'CSE')
    assert departments_match('IT', 'Information Technology')
    assert departments_match('Information Technology', 'IT')
    assert departments_match('ECE', 'Electronics and Communication Engineering')
    assert departments_match('EEE', 'Electrical and Electronics Engineering')
    assert departments_match('AI & DS', 'Artificial Intelligence and Data Science')
    assert departments_match('AI & ML', 'Artificial Intelligence and Machine Learning')


def test_departments_multiple_accepted():
    accepted = ['CSE', 'IT']
    assert student_matches_any_department('Computer Science and Engineering', accepted)
    assert student_matches_any_department('Information Technology', accepted)
    assert not student_matches_any_department('Electronics and Communication Engineering', accepted)


def test_department_no_false_matches_inside_words():
    # "Security" should not match "IT"
    assert normalize_department('Security') != 'Information Technology'
    assert not departments_match('Security', 'IT')
    # "Commerce" should not match "CE"
    assert normalize_department('Commerce') != 'Civil Engineering'
    assert not departments_match('Commerce', 'CE')


# ==============================================================================
# PART 2 & 7.3: Resume Parsing & Department Distinction Tests
# ==============================================================================

def test_resume_extraction_graduation_year_variants():
    # 1. Graduation year beside degree
    text1 = """
    Jane Doe
    jane@example.com
    Bachelor of Technology (B.Tech) - 2026
    Academic Department: Computer Science and Engineering
    CGPA: 9.00 / 10.00
    """
    f1 = extract_profile_fields(text1)
    assert f1['graduation_year'] == 2026
    assert f1['department'] == 'Computer Science and Engineering'
    assert f1['cgpa'] == 9.0

    # 2. Passing year label
    text2 = """
    John Smith
    john@example.com
    Degree: B.Tech
    Passing Year: 2025
    Department: IT
    """
    f2 = extract_profile_fields(text2)
    assert f2['graduation_year'] == 2025
    assert f2['department'] == 'Information Technology'

    # 3. Year of Graduation label
    text3 = """
    Bob Ray
    bob@example.com
    Year of Graduation: 2024
    Department: ECE
    """
    f3 = extract_profile_fields(text3)
    assert f3['graduation_year'] == 2024
    assert f3['department'] == 'Electronics and Communication Engineering'


def test_resume_distinguishes_target_from_academic_department():
    text = """
    Alice Walker
    alice@example.com
    Degree: Bachelor of Technology (B.Tech)
    Academic Department: Computer Science and Engineering
    Target Departments: CSE, IT
    Graduation Year: 2026
    CGPA: 8.8
    """
    fields = extract_profile_fields(text)
    # Actual academic department should be CSE
    assert fields['department'] == 'Computer Science and Engineering'
    # Target departments should be separate
    assert 'target_departments' in fields
    assert 'Computer Science and Engineering' in fields['target_departments']
    assert 'Information Technology' in fields['target_departments']


def test_resume_missing_or_ambiguous_department_requests_confirmation():
    # Text with only target departments but no academic department
    text = """
    Carol White
    carol@example.com
    Target Departments: CSE, IT
    Passing Year: 2026
    """
    fields = extract_profile_fields(text)
    assert fields['needs_confirmation']['department'] is True


def test_profile_autofill_preserves_verified_information(client):
    # Register student
    client.post('/api/auth/register', json={
        'firstName': 'Verify', 'lastName': 'Student', 'email': 'verify@test.com', 'password': 'Password123', 'role': 'student'
    })
    token = client.post('/api/auth/login', json={'email': 'verify@test.com', 'password': 'Password123'}).get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    # Student manually sets verified profile info
    client.put('/api/student/profile', headers=headers, json={
        'department': 'Electronics and Communication Engineering',
        'graduation_year': 2025,
        'cgpa': 9.2
    })

    # Resume autofill attempts to overwrite with different graduation year and department
    autofill_res = client.put('/api/student/profile/autofill', headers=headers, json={
        'values': {
            'department': 'Mechanical Engineering',
            'graduation_year': 2026,
            'cgpa': 7.5,
            'skills': ['Python', 'SQL']
        }
    })
    assert autofill_res.status_code == 200
    body = autofill_res.get_json()
    prof = body['profile']

    # Verified department, graduation year, and cgpa must be preserved
    assert prof['department'] == 'Electronics and Communication Engineering'
    assert prof['graduation_year'] == 2025
    assert prof['cgpa'] == 9.2
    assert 'graduation_year' in body['preserved_fields']
    assert 'department' in body['preserved_fields']
    assert 'cgpa' in body['preserved_fields']
    # Skills applied
    assert 'Python' in prof['skills']
