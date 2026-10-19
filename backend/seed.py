from backend.models import Company, Job, Notification, RecruiterProfile, StudentProfile, User
from backend.extensions import db


SAMPLE_JOB_OPPORTUNITIES = [
    {
        'title': 'Data Analyst Intern',
        'company': 'BrightMetrics',
        'industry': 'Analytics',
        'description': 'Analyze business data, build clear dashboards, and communicate actionable findings to product and operations teams.',
        'skills': ['Python', 'SQL', 'Excel', 'Power BI', 'Tableau', 'Data Analysis'],
        'min_cgpa': 7.0,
        'departments': ['CSE', 'IT', 'ECE', 'Statistics'],
        'location': 'Bengaluru',
        'work_mode': 'Hybrid',
        'salary': '₹8-12 LPA',
        'openings': 3,
    },
    {
        'title': 'Frontend Engineer Intern',
        'company': 'PixelForge',
        'industry': 'Software',
        'description': 'Build accessible web experiences, reusable UI components, and responsive product workflows with the design and engineering teams.',
        'skills': ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'REST API'],
        'min_cgpa': 7.0,
        'departments': ['CSE', 'IT', 'ECE'],
        'location': 'Remote',
        'work_mode': 'Remote',
        'salary': '₹10-15 LPA',
        'openings': 2,
    },
    {
        'title': 'Backend Python Engineer',
        'company': 'CloudHarbor',
        'industry': 'Cloud Services',
        'description': 'Develop reliable APIs and data services, improve test coverage, and collaborate on scalable backend systems.',
        'skills': ['Python', 'Flask', 'Django', 'SQL', 'REST API', 'Docker', 'AWS'],
        'min_cgpa': 7.5,
        'departments': ['CSE', 'IT'],
        'location': 'Hyderabad',
        'work_mode': 'Hybrid',
        'salary': '₹12-18 LPA',
        'openings': 2,
    },
    {
        'title': 'Cloud & DevOps Associate',
        'company': 'SkyBridge Technologies',
        'industry': 'Cloud Services',
        'description': 'Automate build and deployment workflows, support cloud infrastructure, and improve service monitoring and reliability.',
        'skills': ['AWS', 'Docker', 'Kubernetes', 'Python', 'Linux', 'Java'],
        'min_cgpa': 7.0,
        'departments': ['CSE', 'IT', 'ECE'],
        'location': 'Pune',
        'work_mode': 'On-site',
        'salary': '₹9-14 LPA',
        'openings': 3,
    },
    {
        'title': 'Java Software Engineer',
        'company': 'FinNova Systems',
        'industry': 'Financial Technology',
        'description': 'Implement and test transaction services, maintain relational data workflows, and contribute to secure financial products.',
        'skills': ['Java', 'SQL', 'MySQL', 'REST API', 'Docker', 'AWS'],
        'min_cgpa': 7.5,
        'departments': ['CSE', 'IT'],
        'location': 'Chennai',
        'work_mode': 'On-site',
        'salary': '₹11-16 LPA',
        'openings': 4,
    },
    {
        'title': 'Machine Learning Intern',
        'company': 'Insight Labs',
        'industry': 'Artificial Intelligence',
        'description': 'Prepare datasets, evaluate machine-learning experiments, and turn analytical prototypes into reproducible project deliverables.',
        'skills': ['Python', 'SQL', 'Machine Learning', 'Data Analysis'],
        'min_cgpa': 8.0,
        'departments': ['CSE', 'IT', 'Data Science'],
        'location': 'Bengaluru',
        'work_mode': 'Hybrid',
        'salary': '₹15-22 LPA',
        'openings': 2,
    },
    {
        'title': 'QA Automation Engineer',
        'company': 'QualityWorks',
        'industry': 'Software',
        'description': 'Design test plans, automate web application checks, and work with engineers to ship dependable product releases.',
        'skills': ['Python', 'Java', 'JavaScript', 'SQL', 'Docker'],
        'min_cgpa': 6.5,
        'departments': ['CSE', 'IT', 'ECE'],
        'location': 'Noida',
        'work_mode': 'Hybrid',
        'salary': '₹7-11 LPA',
        'openings': 3,
    },
    {
        'title': 'Product Analyst',
        'company': 'MarketPulse',
        'industry': 'Consumer Technology',
        'description': 'Investigate product usage, maintain decision-ready reports, and partner with product teams on experiments and metrics.',
        'skills': ['SQL', 'Excel', 'Python', 'Tableau', 'Data Analysis'],
        'min_cgpa': 7.0,
        'departments': ['CSE', 'IT', 'Business Analytics', 'Statistics'],
        'location': 'Mumbai',
        'work_mode': 'Hybrid',
        'salary': '₹9-13 LPA',
        'openings': 2,
    },
]


def _seed_sample_job_opportunities():
    recruiter = User.query.filter_by(email='recruiter@demo.com').first()
    if not recruiter:
        return

    for opportunity in SAMPLE_JOB_OPPORTUNITIES:
        if Job.query.filter_by(recruiter_id=recruiter.id, title=opportunity['title']).first():
            continue

        company = Company.query.filter_by(name=opportunity['company']).first()
        if not company:
            company = Company(name=opportunity['company'], industry=opportunity['industry'])
            db.session.add(company)
            db.session.flush()

        db.session.add(Job(
            company_id=company.id,
            recruiter_id=recruiter.id,
            title=opportunity['title'],
            description=opportunity['description'],
            required_skills=opportunity['skills'],
            min_cgpa=opportunity['min_cgpa'],
            eligible_departments=opportunity['departments'],
            graduation_year=2026,
            experience_required='0-1 years',
            location=opportunity['location'],
            work_mode=opportunity['work_mode'],
            salary=opportunity['salary'],
            openings=opportunity['openings'],
            status='Published',
        ))

    db.session.commit()


def seed_database(app):
    with app.app_context():
        # Ensure admin user exists even in existing databases
        admin_user = User.query.filter_by(email='admin@demo.com').first()
        if not admin_user:
            admin_user = User(email='admin@demo.com', role='admin', status='active')
            admin_user.set_password('Admin@123')
            db.session.add(admin_user)
            db.session.commit()

        if User.query.filter(User.role != 'admin').count() > 0:
            _seed_sample_job_opportunities()
            return

        student_user = User(email='student@demo.com', role='student', status='active')
        student_user.set_password('Student@123')
        recruiter_user = User(email='recruiter@demo.com', role='recruiter', status='active')
        recruiter_user.set_password('Recruiter@123')
        officer_user = User(email='officer@demo.com', role='officer', status='active')
        officer_user.set_password('Officer@123')

        db.session.add_all([student_user, recruiter_user, officer_user])
        db.session.flush()

        company = Company(name='NovaStack', industry='Technology', website='https://novastack.example')
        db.session.add(company)
        db.session.flush()

        student_profile = StudentProfile(
            user_id=student_user.id, first_name='Aditi', last_name='Sharma', student_id='STU-1001', phone='+91 9876543210',
            university='ABC Institute of Technology', degree='B.Tech', department='CSE', graduation_year=2026, cgpa=8.7,
            preferred_roles=['Software Development', 'Data Analytics'], preferred_locations=['Bengaluru', 'Remote'],
            preferred_industries=['IT'], skills=['Python', 'SQL', 'Flask', 'React', 'JavaScript'],
            certifications=['AWS Cloud Practitioner'], projects=['Campus portal build', 'Portfolio dashboard'], internships=['Software engineering intern']
        )
        recruiter_profile = RecruiterProfile(user_id=recruiter_user.id, company_id=company.id, first_name='Rohan', last_name='Mehta', designation='Talent Acquisition Lead')

        job = Job(
            company_id=company.id, recruiter_id=recruiter_user.id, title='Software Engineer Intern', description='Build scalable interfaces and backend services.',
            required_skills=['Python', 'SQL', 'Flask', 'React'], min_cgpa=8.0, eligible_departments=['CSE', 'IT'], graduation_year=2026,
            experience_required='0-1 years', location='Bengaluru', work_mode='Hybrid', salary='₹12-18 LPA', deadline=None, openings=4, status='Published'
        )

        db.session.add_all([student_profile, recruiter_profile, job])
        db.session.flush()

        db.session.add(Notification(user_id=student_user.id, title='Welcome', message='Your PlacementIQ student profile has been created.', kind='info', link='/student/profile'))
        db.session.add(Notification(user_id=recruiter_user.id, title='Sample data', message='This company has example job data for development.', kind='info', link='/recruiter'))
        db.session.commit()
        _seed_sample_job_opportunities()

        return {'student_user': student_user, 'recruiter_user': recruiter_user, 'officer_user': officer_user, 'admin_user': admin_user}
