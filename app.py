from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room, send
from config import Config
from datetime import datetime

app = Flask(__name__)
app.config.from_object(Config)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active rooms and users
rooms = {}
users = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat')
def chat():
    username = session.get('username')
    if not username:
        return redirect(url_for('index'))
    return render_template('chat.html', username=username, rooms=list(rooms.keys()))

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    if username:
        session['username'] = username
        return redirect(url_for('chat'))
    return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('index'))

@socketio.on('connect')
def handle_connect():
    username = session.get('username')
    if username:
        users[request.sid] = {
            'username': username,
            'rooms': []
        }
        emit('user_connected', {'username': username}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in users:
        username = users[request.sid]['username']
        user_rooms = users[request.sid]['rooms'].copy()
        
        for room in user_rooms:
            leave_room(room)
            if room in rooms and username in rooms[room]['users']:
                rooms[room]['users'].remove(username)
                emit('user_left', {
                    'username': username,
                    'room': room,
                    'users': rooms[room]['users']
                }, room=room)
        
        del users[request.sid]
        emit('user_disconnected', {'username': username}, broadcast=True)

@socketio.on('create_room')
def handle_create_room(data):
    room_name = data.get('room_name')
    username = session.get('username')
    
    if room_name and username:
        if room_name not in rooms:
            rooms[room_name] = {
                'users': [],
                'messages': []
            }
            emit('room_created', {
                'room': room_name,
                'rooms': list(rooms.keys())
            }, broadcast=True)
            return {'success': True, 'message': f'Room "{room_name}" created!'}
        else:
            return {'success': False, 'message': 'Room already exists!'}

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room')
    username = session.get('username')
    
    if room and username:
        if room not in rooms:
            rooms[room] = {
                'users': [],
                'messages': []
            }
        
        join_room(room)
        
        if username not in rooms[room]['users']:
            rooms[room]['users'].append(username)
        
        if request.sid in users:
            if room not in users[request.sid]['rooms']:
                users[request.sid]['rooms'].append(room)
        
        emit('user_joined', {
            'username': username,
            'room': room,
            'users': rooms[room]['users']
        }, room=room)
        
        emit('load_messages', {
            'messages': rooms[room]['messages']
        })

@socketio.on('leave_room')
def handle_leave_room(data):
    room = data.get('room')
    username = session.get('username')
    
    if room and username:
        leave_room(room)
        
        if room in rooms and username in rooms[room]['users']:
            rooms[room]['users'].remove(username)
        
        if request.sid in users and room in users[request.sid]['rooms']:
            users[request.sid]['rooms'].remove(room)
        
        emit('user_left', {
            'username': username,
            'room': room,
            'users': rooms[room]['users'] if room in rooms else []
        }, room=room)

@socketio.on('send_message')
def handle_message(data):
    room = data.get('room')
    message = data.get('message')
    username = session.get('username')
    
    if room and message and username:
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        message_data = {
            'username': username,
            'message': message,
            'timestamp': timestamp
        }
        
        if room in rooms:
            rooms[room]['messages'].append(message_data)
        
        emit('receive_message', message_data, room=room)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)