
const io = require('socket.io-client');

const socket = io('http://localhost:8765', {
    transports: ['websocket', 'polling']
});

console.log('Attempting connection to http://localhost:8765...');

socket.on('connect', () => {
    console.log('✅ Connected successfully!');
    console.log('Socket ID:', socket.id);
    socket.close();
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('❌ Timeout waiting for connection');
    process.exit(1);
}, 5000);
