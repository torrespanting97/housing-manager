from app import app, login_manager, db
from models import Property, User
from flask import render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def home():
    return redirect(url_for('map_view'))

# Authentication Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('map_view'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists')
            return redirect(url_for('signup'))
            
        if User.query.filter_by(email=email).first():
            flash('Email already exists')
            return redirect(url_for('signup'))
            
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        login_user(new_user)
        return redirect(url_for('map_view'))
    
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/map')
@login_required
def map_view():
    properties = Property.query.filter_by(user_id=current_user.id).all()
    properties_dict = [prop.to_dict() for prop in properties]
    return render_template('map_view.html', properties=properties_dict)

@app.route('/list')
@login_required
def list_view():
    # Start with base query for current user's properties
    query = Property.query.filter_by(user_id=current_user.id)
    
    # Apply filters
    min_price = request.args.get('min_price')
    if min_price:
        query = query.filter(Property.price >= float(min_price))
    
    max_price = request.args.get('max_price')
    if max_price:
        query = query.filter(Property.price <= float(max_price))
    
    bedrooms = request.args.get('bedrooms')
    if bedrooms:
        query = query.filter(Property.bedrooms >= int(bedrooms))
    
    bathrooms = request.args.get('bathrooms')
    if bathrooms:
        query = query.filter(Property.bathrooms >= float(bathrooms))
    
    min_size = request.args.get('min_size')
    if min_size:
        query = query.filter(Property.square_feet >= int(min_size))
    
    status = request.args.get('status')
    if status:
        query = query.filter(Property.status == status)
    
    properties = query.all()
    return render_template('list_view.html', properties=properties)

@app.route('/property/<int:property_id>')
@login_required
def property_detail(property_id):
    property = Property.query.filter_by(id=property_id, user_id=current_user.id).first_or_404()
    return render_template('property_detail.html', property=property)

@app.route('/api/properties', methods=['GET'])
@login_required
def api_properties():
    properties = Property.query.filter_by(user_id=current_user.id).all()
    return jsonify([prop.to_dict() for prop in properties])

@app.route('/api/properties/search', methods=['GET'])
@login_required
def search_properties():
    query = request.args.get('q', '')
    if query:
        properties = Property.query.filter(
            Property.address.contains(query),
            Property.user_id == current_user.id
        ).all()
    else:
        properties = Property.query.filter_by(user_id=current_user.id).all()
    return jsonify([prop.to_dict() for prop in properties])

@app.route('/add_property', methods=['GET', 'POST'])
@login_required  # Make sure this decorator is present
def add_property():
    if request.method == 'POST':
        new_property = Property(
            address=request.form['address'],
            latitude=float(request.form['latitude']),
            longitude=float(request.form['longitude']),
            price=float(request.form['price']),
            bedrooms=int(request.form['bedrooms']),
            bathrooms=float(request.form['bathrooms']),
            square_feet=int(request.form['square_feet']),
            lot_size=float(request.form['lot_size']),
            year_built=int(request.form['year_built']),
            description=request.form['description'],
            status=request.form['status'],
            user_id=current_user.id  # THIS IS CRUCIAL
        )
        
        db.session.add(new_property)
        db.session.commit()
        return redirect(url_for('map_view'))
    
    return render_template('add_property.html')

@app.route('/property/<int:property_id>', methods=['DELETE'])
@login_required
def delete_property(property_id):
    try:
        property = Property.query.get_or_404(property_id)
        db.session.delete(property)
        db.session.commit()
        return '', 204  # No content response for successful deletion
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@app.route('/property/<int:property_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_property(property_id):
    property = Property.query.get_or_404(property_id)
    
    if request.method == 'POST':
        # Update property with form data
        property.address = request.form['address']
        property.latitude=float(request.form['latitude'])
        property.longitude=float(request.form['longitude'])
        property.price = float(request.form['price'])
        property.bedrooms = int(request.form['bedrooms'])
        property.bathrooms = float(request.form['bathrooms'])
        property.square_feet = int(request.form['square_feet'])
        property.lot_size = float(request.form['lot_size'])
        property.year_built = int(request.form['year_built'])
        property.description = request.form['description']
        property.status = request.form['status']
        
        db.session.commit()
        return redirect(url_for('property_detail', property_id=property.id))
    
    # For GET request, show edit form
    return render_template('edit_property.html', property=property)