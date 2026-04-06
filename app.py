from flask import Flask, render_template, request, jsonify, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from mutagen.mp3 import MP3
import os
import json
from datetime import datetime
import os

# Cấu hình database
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///music.db'

import os

# Cấu hình thư mục upload
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', '/opt/render/project/src/static/uploads')
IMAGE_UPLOAD_FOLDER = os.environ.get('IMAGE_UPLOAD_FOLDER', '/opt/render/project/src/static/images')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['IMAGE_UPLOAD_FOLDER'] = IMAGE_UPLOAD_FOLDER

# Tạo thư mục nếu chưa có
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['IMAGE_UPLOAD_FOLDER'], exist_ok=True)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///music.db'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a'}

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Create upload folder if not exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    songs = db.relationship('Song', backref='user', lazy=True)

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    artist = db.Column(db.String(100), default='Unknown Artist')
    filename = db.Column(db.String(300), nullable=False)
    filepath = db.Column(db.String(500), nullable=False)
    duration = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    play_count = db.Column(db.Integer, default=0)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_audio_duration(filepath):
    try:
        audio = MP3(filepath)
        return int(audio.info.length)
    except:
        return 0

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    hashed_password = generate_password_hash(password)
    user = User(username=username, password=hashed_password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password, password):
        login_user(user)
        return jsonify({'message': 'Login successful', 'user': username})
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/songs', methods=['GET'])
def get_songs():
    if current_user.is_authenticated:
        songs = Song.query.filter_by(user_id=current_user.id).order_by(Song.uploaded_at.desc()).all()
    else:
        # Return sample songs for non-logged in users
        songs = Song.query.order_by(Song.play_count.desc()).limit(10).all()
    
    songs_data = []
    for song in songs:
        songs_data.append({
            'id': song.id,
            'title': song.title,
            'artist': song.artist,
            'duration': song.duration,
            'filepath': song.filepath,
            'play_count': song.play_count,
            'username': song.user.username if song.user else 'Unknown'
        })
    
    return jsonify(songs_data)

@app.route('/api/upload', methods=['POST'])
@login_required
def upload_song():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    title = request.form.get('title', '')
    artist = request.form.get('artist', '')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Add timestamp to avoid duplicates
        unique_filename = f"{datetime.now().timestamp()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Get duration
        duration = get_audio_duration(filepath)
        
        # If title not provided, use filename without extension
        if not title:
            title = os.path.splitext(filename)[0]
        
        song = Song(
            title=title,
            artist=artist if artist else 'Unknown Artist',
            filename=unique_filename,
            filepath=f'/static/uploads/{unique_filename}',
            duration=duration,
            user_id=current_user.id
        )
        
        db.session.add(song)
        db.session.commit()
        
        return jsonify({
            'message': 'Song uploaded successfully',
            'song': {
                'id': song.id,
                'title': song.title,
                'artist': song.artist,
                'duration': song.duration,
                'filepath': song.filepath
            }
        })
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/song/<int:song_id>/play', methods=['POST'])
def increment_play_count(song_id):
    song = Song.query.get(song_id)
    if song:
        song.play_count += 1
        db.session.commit()
    return jsonify({'success': True})

@app.route('/api/user/stats')
@login_required
def user_stats():
    songs_count = Song.query.filter_by(user_id=current_user.id).count()
    total_plays = db.session.query(db.func.sum(Song.play_count)).filter_by(user_id=current_user.id).scalar() or 0
    
    return jsonify({
        'songs_count': songs_count,
        'total_plays': total_plays
    })

@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
    
    import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)