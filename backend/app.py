import os
from flask import Flask, jsonify
from sqlalchemy import inspect
from backend.config import Config, TestingConfig
from backend.extensions import cors, db, jwt
from backend.seed import seed_database
from backend.routes.auth import blueprint as auth_bp
from backend.routes.career import blueprint as career_bp
from backend.routes.dashboard import blueprint as dashboard_bp
from backend.routes.jobs import blueprint as jobs_bp
from backend.routes.notifications import blueprint as notifications_bp
from backend.routes.resume import blueprint as resume_bp
from backend.routes.student import blueprint as student_bp


def create_app(test_config=None):
    app = Flask(__name__)
    if test_config:
        app.config.from_object(test_config)
    else:
        app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": os.getenv('FRONTEND_URL', '*')}})

    with app.app_context():
        import backend.models  # noqa: F401
        db.create_all()

        profile_columns = {column['name'] for column in inspect(db.engine).get_columns('student_profiles')}
        if 'field_sources' not in profile_columns:
            with db.engine.begin() as conn:
                conn.execute(db.text('ALTER TABLE student_profiles ADD COLUMN field_sources JSON'))

        # Add optional columns to existing tables if missing in SQLite
        for statement in [
            "ALTER TABLE notifications ADD COLUMN link VARCHAR(250)",
            "ALTER TABLE applications ADD COLUMN interview_date DATETIME"
        ]:
            try:
                with db.engine.connect() as conn:
                    conn.execute(db.text(statement))
                    conn.commit()
            except Exception:
                pass

        seed_database(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(career_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(resume_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(notifications_bp)

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({'error': 'Resource not found.'}), 404

    @app.errorhandler(413)
    def request_too_large(_):
        return jsonify({'error': 'The uploaded file exceeds the 5 MB limit.'}), 413

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({'error': 'An unexpected server error occurred.'}), 500

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
