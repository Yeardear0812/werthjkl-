let localStream;
let peerConnections = new Map(); // Store multiple peer connections
let ws; // WebSocket connection

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

function connectToSignalingServer() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'new-peer':
                // Create offer for new peer
                const peerConnection = createPeerConnection();
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                ws.send(JSON.stringify({
                    type: 'offer',
                    offer: offer
                }));
                break;
                
            case 'offer':
                const pc = createPeerConnection();
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                ws.send(JSON.stringify({
                    type: 'answer',
                    answer: answer
                }));
                break;
                
            case 'answer':
                await peerConnections.get(data.peerId).setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
                break;
                
            case 'ice-candidate':
                await peerConnections.get(data.peerId).addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                );
                break;
        }
    };
}

function createPeerConnection() {
    const peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle incoming remote stream
    peerConnection.ontrack = event => {
        const remoteVideo = document.createElement('video');
        remoteVideo.autoplay = true;
        remoteVideo.playsinline = true;
        remoteVideo.srcObject = event.streams[0];
        document.querySelector('.video-container').appendChild(remoteVideo);
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate
            }));
        }
    };
    
    return peerConnection;
}

async function createMeeting() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        
        const meetingId = Math.random().toString(36).substring(7);
        document.getElementById('meetingId').value = meetingId;
        document.getElementById('currentMeetingId').textContent = meetingId;
        
        document.querySelector('.meeting-room').style.display = 'block';
        document.querySelector('.join-meeting').style.display = 'none';
        
        // Connect to signaling server and join room
        connectToSignalingServer();
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'join',
                roomId: meetingId
            }));
        };
    } catch (error) {
        console.error('Error creating meeting:', error);
    }
}

async function joinMeeting() {
    try {
        const meetingId = document.getElementById('meetingId').value;
        if (!meetingId) {
            alert('Please enter a meeting ID');
            return;
        }
        
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('currentMeetingId').textContent = meetingId;
        
        document.querySelector('.meeting-room').style.display = 'block';
        document.querySelector('.join-meeting').style.display = 'none';
        
        // Connect to signaling server and join room
        connectToSignalingServer();
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'join',
                roomId: meetingId
            }));
        };
    } catch (error) {
        console.error('Error joining meeting:', error);
    }
}

function toggleMic() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
}

function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
}

function leaveMeeting() {
    // Stop all tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connections
    peerConnections.forEach(peerConnection => peerConnection.close());
    
    // Reset UI
    document.querySelector('.meeting-room').style.display = 'none';
    document.querySelector('.join-meeting').style.display = 'block';
    document.getElementById('meetingId').value = '';
}

function copyMeetingId() {
    const meetingId = document.getElementById('currentMeetingId').textContent;
    navigator.clipboard.writeText(meetingId).then(() => {
        alert('Meeting ID copied to clipboard!');
    });
} 