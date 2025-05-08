from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///properties.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Initialize extensions
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'login'  # This sets the default login view
migrate.init_app(app, db)

# Import routes after app creation to avoid circular imports
from routes import *

if __name__ == '__main__':
    app.run(debug=True)