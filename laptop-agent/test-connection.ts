import { io } from 'socket.io-client';

// Connect to backend as a test agent
const socket = io('https://vibestudio.example.com/remote-agent', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected, registering as test-agent-verify...');
  socket.emit('agent:register', {
    secret: '48d8a63b17f8283d2ccc33abd1d1d68f9eb79284b1ca0edeb754115ccd4dd090',
    hostname: 'test-agent-verify',
    capabilities: ['list-transcripts']
  });
});

socket.on('agent:registered', (data: any) => {
  console.log('✅ Registration successful!');
  console.log('   Agent ID:', data.agentId);
  console.log('   Token received:', data.token ? 'Yes' : 'No');
  setTimeout(() => {
    console.log('Test complete - disconnecting');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('agent:job', (job: any) => {
  console.log('📥 Received job:', job);
});

socket.on('agent:error', (err: any) => {
  console.log('❌ Error:', err);
  socket.disconnect();
  process.exit(1);
});

socket.on('connect_error', (err: Error) => {
  console.log('❌ Connection error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏱️ Timeout waiting for response');
  process.exit(1);
}, 10000);
