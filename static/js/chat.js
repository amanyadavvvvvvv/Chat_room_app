const socket = io();

let currentRoom = null;
let availableRooms = new Set();

// DOM Elements
const roomList = document.getElementById('roomList');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatArea = document.getElementById('chatArea');
const currentRoomName = document.getElementById('currentRoomName');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const createRoomModal = document.getElementById('createRoomModal');
const roomNameInput = document.getElementById('roomNameInput');
const confirmCreateRoom = document.getElementById('confirmCreateRoom');
const cancelCreateRoom = document.getElementById('cancelCreateRoom');
const usersList = document.getElementById('usersList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadInitialRooms();
    setupEventListeners();
});

function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Create room
    createRoomBtn.addEventListener('click', () => {
        createRoomModal.classList.add('active');
        roomNameInput.focus();
    });

    confirmCreateRoom.addEventListener('click', createRoom);
    cancelCreateRoom.addEventListener('click', () => {
        createRoomModal.classList.remove('active');
        roomNameInput.value = '';
    });

    roomNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createRoom();
        }
    });

    // Leave room
    leaveRoomBtn.addEventListener('click', leaveRoom);
}

function loadInitialRooms() {
    // Create a default room
    availableRooms.add('General');
    updateRoomList();
}

function updateRoomList() {
    roomList.innerHTML = '';
    availableRooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.textContent = room;
        if (room === currentRoom) {
            roomItem.classList.add('active');
        }
        roomItem.addEventListener('click', () => joinRoom(room));
        roomList.appendChild(roomItem);
    });
}

function createRoom() {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('create_room', { room_name: roomName }, (response) => {
            if (response.success) {
                availableRooms.add(roomName);
                updateRoomList();
                joinRoom(roomName);
            } else {
                alert(response.message);
            }
        });
        createRoomModal.classList.remove('active');
        roomNameInput.value = '';
    }
}

function joinRoom(room) {
    if (currentRoom === room) return;

    if (currentRoom) {
        socket.emit('leave_room', { room: currentRoom });
    }

    currentRoom = room;
    socket.emit('join_room', { room: room });

    welcomeScreen.style.display = 'none';
    chatArea.style.display = 'flex';
    currentRoomName.textContent = room;
    messages.innerHTML = '';
    
    updateRoomList();
}

function leaveRoom() {
    if (currentRoom) {
        socket.emit('leave_room', { room: currentRoom });
        currentRoom = null;
        chatArea.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        updateRoomList();
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
        socket.emit('send_message', {
            room: currentRoom,
            message: message
        });
        messageInput.value = '';
        messageInput.focus();
    }
}

function addMessage(data, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const messageHeader = document.createElement('div');
    messageHeader.className = 'message-header';
    
    const messageUsername = document.createElement('span');
    messageUsername.className = 'message-username';
    messageUsername.textContent = data.username;
    
    const messageTimestamp = document.createElement('span');
    messageTimestamp.className = 'message-timestamp';
    messageTimestamp.textContent = data.timestamp;
    
    messageHeader.appendChild(messageUsername);
    messageHeader.appendChild(messageTimestamp);
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = data.message;
    
    messageContent.appendChild(messageHeader);
    messageContent.appendChild(messageText);
    messageDiv.appendChild(messageContent);
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// Socket.IO Event Handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('room_created', (data) => {
    availableRooms.add(data.room);
    updateRoomList();
});

socket.on('user_joined', (data) => {
    if (data.room === currentRoom) {
        addSystemMessage(`${data.username} joined the room`);
        updateUsersList(data.users);
    }
});

socket.on('user_left', (data) => {
    if (data.room === currentRoom) {
        addSystemMessage(`${data.username} left the room`);
        updateUsersList(data.users);
    }
});

socket.on('receive_message', (data) => {
    const isOwn = data.username === username;
    addMessage(data, isOwn);
});

socket.on('load_messages', (data) => {
    messages.innerHTML = '';
    data.messages.forEach(msg => {
        const isOwn = msg.username === username;
        addMessage(msg, isOwn);
    });
});

function updateUsersList(users) {
    usersList.textContent = users.join(', ');
}

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});