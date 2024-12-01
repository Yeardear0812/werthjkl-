const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'join':
                const roomId = data.roomId;
                ws.roomId = roomId;
                
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                rooms.get(roomId).add(ws);
                
                // Notify other participants about the new peer
                rooms.get(roomId).forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({
                            type: 'new-peer'
                        }));
                    }
                });
                break;
                
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                // Forward messages to other peers in the room
                rooms.get(ws.roomId)?.forEach(client => {
                    if (client !== ws) {
                        client.send(message);
                    }
                });
                break;
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).delete(ws);
            if (rooms.get(ws.roomId).size === 0) {
                rooms.delete(ws.roomId);
            }
        }
    });
}); 