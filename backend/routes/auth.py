from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash
from backend.extensions import db
from backend.models import StudentProfile, User
import re

blueprint = Blueprint('auth', __name__, url_prefix='/api/auth')

@blueprint.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    role = (data.get('role') or 'student').lower()

    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'error': 'Valid email is required.'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters long.'}), 400
    if role not in {'student', 'recruiter', 'officer', 'admin'}:
        return jsonify({'error': 'Unsupported role.'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'A user with this email already exists.'}), 409

    user = User(email=email, role=role, status='active')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    if role == 'student':
        profile = StudentProfile(user_id=user.id, first_name=data.get('firstName', 'Student'), last_name=data.get('lastName', 'User'))
        db.session.add(profile)

    db.session.commit()
    return jsonify({'message': 'User registered successfully.', 'user': user.to_public_dict()}), 201


@blueprint.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password.'}), 401
    if user.status == 'suspended':
        return jsonify({'error': 'This account has been suspended by an administrator.'}), 403
    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_public_dict()})


@blueprint.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    new_password = data.get('new_password', '')
    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters long.'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        # Avoid user enumeration in public responses
        return jsonify({'message': 'If the email exists in our records, password has been reset.'}), 200
    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password has been reset successfully. You can now sign in.'}), 200


@blueprint.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return jsonify({'user': user.to_public_dict()})


@blueprint.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Logout successful.'})
