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
                ws.peerId = Math.random().toString(36).substring(7);
                
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                rooms.get(roomId).add(ws);
                
                // Notify other participants about the new peer
                rooms.get(roomId).forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({
                            type: 'new-peer',
                            peerId: ws.peerId
                        }));
                    }
                });
                break;
                
            case 'offer':
                // Forward offer to all peers in the room
                rooms.get(ws.roomId)?.forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({
                            type: 'offer',
                            offer: data.offer,
                            peerId: ws.peerId
                        }));
                    }
                });
                break;
                
            case 'answer':
                // Forward answer to the specific peer
                rooms.get(ws.roomId)?.forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({
                            type: 'answer',
                            answer: data.answer,
                            peerId: ws.peerId
                        }));
                    }
                });
                break;
                
            case 'ice-candidate':
                // Forward ICE candidates to all other peers
                rooms.get(ws.roomId)?.forEach(client => {
                    if (client !== ws) {
                        client.send(JSON.stringify({
                            type: 'ice-candidate',
                            candidate: data.candidate,
                            peerId: ws.peerId
                        }));
                    }
                });
                break;
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms.has(ws.roomId)) {
            rooms.get(ws.roomId).delete(ws);
            // Notify others that peer has left
            rooms.get(ws.roomId).forEach(client => {
                client.send(JSON.stringify({
                    type: 'peer-left',
                    peerId: ws.peerId
                }));
            });
            if (rooms.get(ws.roomId).size === 0) {
                rooms.delete(ws.roomId);
            }
        }
    });
}); 