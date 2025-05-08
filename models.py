from app import db
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    properties = db.relationship('Property', backref='owner', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Property(db.Model):
    __tablename__ = 'properties'
    
    id = db.Column(db.Integer, primary_key=True)
    address = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=False)
    bedrooms = db.Column(db.Integer, nullable=False)
    bathrooms = db.Column(db.Numeric(3, 1), nullable=False)
    square_feet = db.Column(db.Integer, nullable=False)
    lot_size = db.Column(db.Numeric(10, 2))
    year_built = db.Column(db.Integer)
    status = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text)
    latitude = db.Column(db.Numeric(30, 25))
    longitude = db.Column(db.Numeric(30, 25))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    status = db.Column(db.String(50), default="For Sale")
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    new_field = db.Column(db.String(100))  # Add this new field
    
    def __repr__(self):
        return f'<Property {self.address}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'price': self.price,
            'bedrooms': self.bedrooms,
            'bathrooms': self.bathrooms,
            'square_feet': self.square_feet,
            'lot_size': self.lot_size,
            'year_built': self.year_built,
            'description': self.description,
            'status': self.status,
            'user_id': self.user_id
        }