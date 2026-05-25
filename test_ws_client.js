import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  
  // 测试同步对话列表
  ws.send(JSON.stringify({
    type: 'sync_conversations',
    data: {},
    timestamp: Date.now(),
    request_id: 'test-001'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', JSON.stringify(message, null, 2));
  
  if (message.type === 'sync_conversations') {
    console.log('✅ Sync conversations success!');
    console.log('Conversations:', message.data.conversations);
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('⏱️  Timeout, closing...');
  ws.close();
}, 5000);
