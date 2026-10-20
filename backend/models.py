from datetime import datetime
from werkzeug.security import generate_password_hash
from backend.extensions import db

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default='student')
    status = db.Column(db.String(30), nullable=False, default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student_profile = db.relationship('StudentProfile', uselist=False, back_populates='user')
    recruiter_profile = db.relationship('RecruiterProfile', uselist=False, back_populates='user')
    notifications = db.relationship('Notification', back_populates='user', cascade='all, delete-orphan')
    resumes = db.relationship('Resume', back_populates='user', cascade='all, delete-orphan')
    applications = db.relationship('Application', back_populates='student', cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', back_populates='user', cascade='all, delete-orphan')
    career_recommendations = db.relationship('CareerRecommendation', back_populates='user', cascade='all, delete-orphan')
    skill_evidences = db.relationship('SkillEvidence', back_populates='user', cascade='all, delete-orphan')
    roadmap_tasks = db.relationship('RoadmapTask', back_populates='user', cascade='all, delete-orphan')
    interview_attempts = db.relationship('InterviewAttempt', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def to_public_dict(self):
        return {'id': self.id, 'email': self.email, 'role': self.role, 'status': self.status}

class StudentProfile(db.Model):
    __tablename__ = 'student_profiles'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    student_id = db.Column(db.String(50))
    phone = db.Column(db.String(30))
    university = db.Column(db.String(120))
    degree = db.Column(db.String(120))
    department = db.Column(db.String(120))
    graduation_year = db.Column(db.Integer)
    cgpa = db.Column(db.Float)
    preferred_roles = db.Column(db.JSON, default=list)
    preferred_locations = db.Column(db.JSON, default=list)
    preferred_industries = db.Column(db.JSON, default=list)
    skills = db.Column(db.JSON, default=list)
    certifications = db.Column(db.JSON, default=list)
    projects = db.Column(db.JSON, default=list)
    internships = db.Column(db.JSON, default=list)
    field_sources = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='student_profile')

    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id, 'first_name': self.first_name, 'last_name': self.last_name,
            'student_id': self.student_id, 'phone': self.phone, 'university': self.university,
            'degree': self.degree, 'department': self.department, 'graduation_year': self.graduation_year,
            'cgpa': self.cgpa, 'preferred_roles': self.preferred_roles or [], 'preferred_locations': self.preferred_locations or [],
            'preferred_industries': self.preferred_industries or [], 'skills': self.skills or [], 'certifications': self.certifications or [],
            'projects': self.projects or [], 'internships': self.internships or [],
            'field_sources': self.field_sources or {}
        }

class Company(db.Model):
    __tablename__ = 'companies'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    industry = db.Column(db.String(120))
    website = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    jobs = db.relationship('Job', back_populates='company', cascade='all, delete-orphan')
    recruiters = db.relationship('RecruiterProfile', back_populates='company', cascade='all, delete-orphan')

class RecruiterProfile(db.Model):
    __tablename__ = 'recruiter_profiles'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=True)
    first_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80))
    designation = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='recruiter_profile')
    company = db.relationship('Company', back_populates='recruiters')

class Job(db.Model):
    __tablename__ = 'jobs'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    recruiter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    required_skills = db.Column(db.JSON, default=list)
    min_cgpa = db.Column(db.Float, default=0.0)
    eligible_departments = db.Column(db.JSON, default=list)
    graduation_year = db.Column(db.Integer)
    experience_required = db.Column(db.String(50))
    location = db.Column(db.String(120))
    work_mode = db.Column(db.String(40))
    salary = db.Column(db.String(50))
    deadline = db.Column(db.DateTime)
    openings = db.Column(db.Integer, default=1)
    status = db.Column(db.String(30), default='Published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = db.relationship('Company', back_populates='jobs')
    applications = db.relationship('Application', back_populates='job', cascade='all, delete-orphan')

class Resume(db.Model):
    __tablename__ = 'resumes'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    file_path = db.Column(db.String(250), nullable=False)
    status = db.Column(db.String(40), default='uploaded')
    extracted_skills = db.Column(db.JSON, default=list)
    analysis = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='resumes')

class Application(db.Model):
    __tablename__ = 'applications'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    status = db.Column(db.String(40), default='Applied')
    cover_note = db.Column(db.Text)
    interview_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = db.relationship('User', back_populates='applications')
    job = db.relationship('Job', back_populates='applications')
    feedbacks = db.relationship('ApplicationFeedback', back_populates='application', cascade='all, delete-orphan')

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    kind = db.Column(db.String(40), default='info')
    link = db.Column(db.String(250), nullable=True)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='notifications')

class CareerRecommendation(db.Model):
    __tablename__ = 'career_recommendations'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    reason = db.Column(db.Text)
    skills = db.Column(db.JSON, default=list)
    roadmap = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='career_recommendations')

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(120), nullable=False)
    entity_type = db.Column(db.String(80))
    entity_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='audit_logs')

class SkillEvidence(db.Model):
    __tablename__ = 'skill_evidences'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    skill_name = db.Column(db.String(100), nullable=False)
    tier = db.Column(db.String(40), default='self_reported')  # 'self_reported', 'assessed', 'evidence_backed', 'verified'
    evidence_type = db.Column(db.String(50))  # 'github', 'project', 'certification', 'quiz'
    evidence_url = db.Column(db.String(255))
    verification_notes = db.Column(db.Text)
    score = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='skill_evidences')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'skill_name': self.skill_name,
            'tier': self.tier,
            'evidence_type': self.evidence_type,
            'evidence_url': self.evidence_url,
            'verification_notes': self.verification_notes,
            'score': self.score,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class RoadmapTask(db.Model):
    __tablename__ = 'roadmap_tasks'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    timeframe = db.Column(db.String(20), default='7-day')  # '7-day', '30-day', '60-day'
    priority = db.Column(db.String(20), default='Medium')  # 'High', 'Medium', 'Low'
    estimated_effort = db.Column(db.String(50))
    completion_criteria = db.Column(db.Text)
    reason = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='roadmap_tasks')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'timeframe': self.timeframe,
            'priority': self.priority,
            'estimated_effort': self.estimated_effort,
            'completion_criteria': self.completion_criteria,
            'reason': self.reason,
            'completed': self.completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class InterviewAttempt(db.Model):
    __tablename__ = 'interview_attempts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role_target = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), default='Technical')
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    score = db.Column(db.Float, default=0.0)
    feedback = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='interview_attempts')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role_target': self.role_target,
            'category': self.category,
            'question': self.question,
            'answer': self.answer,
            'score': self.score,
            'feedback': self.feedback or {},
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ApplicationFeedback(db.Model):
    __tablename__ = 'application_feedbacks'
    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('applications.id'), nullable=False)
    recruiter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    stage = db.Column(db.String(50))
    strengths = db.Column(db.Text)
    gaps = db.Column(db.Text)
    recommendations = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    application = db.relationship('Application', back_populates='feedbacks')
    recruiter = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'application_id': self.application_id,
            'recruiter_id': self.recruiter_id,
            'stage': self.stage,
            'strengths': self.strengths,
            'gaps': self.gaps,
            'recommendations': self.recommendations,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
