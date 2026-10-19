from datetime import datetime
from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from backend.extensions import db
from backend.models import Notification

blueprint = Blueprint('notifications', __name__, url_prefix='/api')

@blueprint.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
    unread_count = Notification.query.filter_by(user_id=user_id, read_at=None).count()
    return jsonify({
        'notifications': [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'kind': n.kind,
            'link': getattr(n, 'link', None),
            'read_at': n.read_at.isoformat() if n.read_at else None,
            'created_at': n.created_at.isoformat() if n.created_at else None
        } for n in notifications],
        'unread_count': unread_count
    })

@blueprint.route('/notifications/<int:nid>/read', methods=['PATCH'])
@jwt_required()
def mark_read(nid):
    user_id = int(get_jwt_identity())
    notification = Notification.query.filter_by(id=nid, user_id=user_id).first_or_404()
    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        db.session.commit()
    return jsonify({'message': 'Notification marked as read.', 'id': nid})

@blueprint.route('/notifications/read-all', methods=['PATCH'])
@jwt_required()
def mark_all_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(user_id=user_id, read_at=None).update({'read_at': datetime.utcnow()})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read.'})

