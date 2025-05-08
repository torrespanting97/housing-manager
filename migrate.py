from app import app, db
from models import Property, User
import datetime

with app.app_context():
    # Create a unique email using timestamp
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    temp_email = f"temp_{timestamp}@example.com"
    
    # Create a temporary user for existing properties
    temp_user = User(username=f"temp_{timestamp}", email=temp_email)
    temp_user.set_password('temp_password')
    db.session.add(temp_user)
    db.session.commit()
    
    # Add user_id to existing properties
    for property in Property.query.all():
        property.user_id = temp_user.id
    db.session.commit()
    
    print(f"Migration complete. All existing properties assigned to '{temp_user.username}' user.")