const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Store active rooms
const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type);
            
            switch (data.type) {
                case 'join':
                    const roomId = data.roomId;
                    ws.roomId = roomId;
                    ws.peerId = Math.random().toString(36).substring(7);
                    
                    if (!rooms.has(roomId)) {
                        rooms.set(roomId, new Set());
                    }
                    rooms.get(roomId).add(ws);
                    
                    console.log(`Peer ${ws.peerId} joined room ${roomId}`);
                    
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
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${ws.peerId} disconnected`);
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 