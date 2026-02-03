import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "/src/styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { useParams } from 'react-router-dom';
import server from '../environment';

const server_url = server ?? window.location.origin; // fallback if `server` is undefined

var connections = {};

// Remote Video Component for optimizing rendering

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

const RemoteVideo = ({ video, styles, fullScreenVideo, toggleFullScreen }) => {
    const videoRef = useRef();

    useEffect(() => {
        if (videoRef.current && video.stream) {
            videoRef.current.srcObject = video.stream;
        }
    }, [video.stream]);

    return (
        <div className={`${styles.remoteVideoContainer} ${fullScreenVideo === video.socketId ? styles.fullScreenMode : ''}`}>
            <video
                data-socket={video.socketId}
                ref={videoRef}
                autoPlay
            >
            </video>
            <div className={styles.videoOptions}>
                <IconButton onClick={() => toggleFullScreen(video.socketId)} style={{ color: "white" }}>
                    {fullScreenVideo === video.socketId ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
                </IconButton>
            </div>
        </div>
    );
};

export default function VideoMeetComponent() {
    const { url } = useParams();
    // ... existing state and refs ...
    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState(true);

    let [audio, setAudio] = useState(true);

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(3);

    let [username, setUsername] = useState("Guest");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    // State for tracking which video is in full screen mode (socketId or 'local')
    let [fullScreenVideo, setFullScreenVideo] = useState(null);

    const toggleFullScreen = (id) => {
        if (fullScreenVideo === id) {
            setFullScreenVideo(null); // Exit full screen
        } else {
            setFullScreenVideo(id); // Enter full screen
        }
    }

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        const start = async () => {
            await getPermissions();
            getMedia();
        }
        start();

        // Cleanup function to disconnect socket on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            connections = {};
        };
    }, [])

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => {
                        console.log("Error getting display media", e);
                        setScreen(false); // Reset to false loop if user cancels
                    });
            }
        } else {
            // Stop logic: If screen became false, stop the shared tracks
            if (window.localStream) {
                // If the current stream is a screen share (you might want to track this more formally), stop it.
                // Stopping the track will trigger the 'onended' event we attached in getDislayMediaSuccess
                window.localStream.getTracks().forEach(track => track.stop());
                setScreen(false);
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) localVideoref.current.srcObject = userMediaStream;
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }


    let getDislayMediaSuccess = (stream) => {
        console.log("Here: Screen share success");
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            const videoSender = connections[id].getSenders().find(s => s.track && s.track.kind === 'video');
            const screenVideoTrack = stream.getVideoTracks()[0];

            if (videoSender && screenVideoTrack) {
                videoSender.replaceTrack(screenVideoTrack).catch(e => console.log("Error replacing track", e));
            } else if (screenVideoTrack) {
                // If no video sender found (e.g. joined audio only), add the track
                connections[id].addTrack(screenVideoTrack, stream);
            }

            // Also handle audio if present in screen share
            const screenAudioTrack = stream.getAudioTracks()[0];
            const audioSender = connections[id].getSenders().find(s => s.track && s.track.kind === 'audio');
            if (audioSender && screenAudioTrack) {
                audioSender.replaceTrack(screenAudioTrack).catch(e => console.log("Error replacing audio track", e));
            } else if (screenAudioTrack) {
                connections[id].addTrack(screenAudioTrack, stream);
            }

            // Create offer to signal changes
            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            // Revert nicely to black/silence or back to camera? 
            // Better to just go back to black/silence to force user to toggle video back on if they want
            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream
        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].ontrack = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.streams[0] } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            // Create a new video
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.streams[0],
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };


                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        // connections[socketListId].addStream(window.localStream)
                        window.localStream.getTracks().forEach(track => {
                            connections[socketListId].addTrack(track, window.localStream);
                        })
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        // connections[socketListId].addStream(window.localStream)
                        window.localStream.getTracks().forEach(track => {
                            connections[socketListId].addTrack(track, window.localStream);
                        })
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);

        if (!video) {
            // Turning Video ON: Get new stream
            navigator.mediaDevices.getUserMedia({ video: true })
                .then((newStream) => {
                    const newVideoTrack = newStream.getVideoTracks()[0];

                    // Replace track in local stream
                    const oldVideoTrack = window.localStream.getVideoTracks()[0];
                    if (oldVideoTrack) {
                        window.localStream.removeTrack(oldVideoTrack);
                        oldVideoTrack.stop(); // ensuring cleanliness
                    }
                    window.localStream.addTrack(newVideoTrack);

                    // Update local video element
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = window.localStream;
                    }

                    // Replace track for all peers
                    for (let id in connections) {
                        const sender = connections[id].getSenders().find(s => s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(newVideoTrack);
                        }
                    }
                })
                .catch(e => console.log("Error turning on video:", e));

        } else {
            // Turning Video OFF: Stop track and replace with black
            const videoTrack = window.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.stop(); // This turns off the camera hardware light
            }

            const blackTrack = black(); // Using our helper which returns a disabled video track from canvas

            window.localStream.removeTrack(videoTrack);
            window.localStream.addTrack(blackTrack);

            if (localVideoref.current) {
                localVideoref.current.srcObject = window.localStream;
            }

            for (let id in connections) {
                const sender = connections[id].getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(blackTrack);
                }
            }
        }
    }
    let handleAudio = () => {
        setAudio(!audio)
        if (window.localStream) {
            const audioTrack = window.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
            }
        }
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/home"
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data, socketIdSender: socketIdSender }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }


    return (
        <div>

            <div className={styles.meetVideoContainer}>

                <div className={styles.meetingInfo}>
                    <h2>Meeting Code: {url}</h2>
                    <IconButton onClick={() => {
                        navigator.clipboard.writeText(url);
                        alert("Meeting Code copied!");
                    }} size="small" style={{ color: "white" }}>
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </div>

                {showModal ? <div className={styles.chatRoom}>
                    <div className={styles.chatContainer}>
                        <div className={styles.chatHeader}>
                            <h1>Chat</h1>
                            <IconButton onClick={closeChat} size="small">
                                <CloseIcon />
                            </IconButton>
                        </div>

                        <div className={styles.chattingDisplay}>
                            {messages.length !== 0 ? messages.map((item, index) => {
                                const isMine = item.socketIdSender === socketIdRef.current;
                                return (
                                    <div className={`${styles.msgBlock} ${isMine ? styles.mine : styles.other}`} key={index}>
                                        <span className={styles.senderName}>{item.sender}</span>
                                        <div className={styles.msgContent}>{item.data}</div>
                                    </div>
                                )
                            }) : <p style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>No Messages Yet</p>}
                        </div>

                        <div className={styles.chattingArea}>
                            <TextField
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        sendMessage();
                                    }
                                }}
                                placeholder="Type a message..."
                                variant="outlined"
                                fullWidth
                                size="small"
                                InputProps={{
                                    style: { borderRadius: '20px', backgroundColor: '#f0f2f5' }
                                }}
                            />
                            <IconButton onClick={sendMessage} color="primary" disabled={message.trim() === ""}>
                                <SendIcon />
                            </IconButton>
                        </div>
                    </div>
                </div> : null}


                <div className={styles.buttonContainers}>
                    <IconButton onClick={handleVideo} style={{ color: "white" }}>
                        {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                    </IconButton>
                    <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                        <CallEndIcon />
                    </IconButton>
                    <IconButton onClick={handleAudio} style={{ color: "white" }}>
                        {audio === true ? <MicIcon /> : <MicOffIcon />}
                    </IconButton>

                    {screenAvailable === true ?
                        <IconButton onClick={handleScreen} style={{ color: "white" }}>
                            {screen === true ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                        </IconButton> : <></>}

                    <Badge badgeContent={newMessages} max={999} color='orange'>
                        <IconButton onClick={() => setModal(!showModal)} style={{ color: "white" }}>
                            <ChatIcon />                        </IconButton>
                    </Badge>

                </div>


                <div className={`${styles.meetUserVideo} ${fullScreenVideo === 'local' ? styles.fullScreenMode : ''}`}>
                    <video className="border-3" ref={localVideoref} autoPlay muted></video>
                    <div className={styles.videoOptions}>
                        <IconButton onClick={() => toggleFullScreen('local')} style={{ color: "white" }}>
                            {fullScreenVideo === 'local' ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
                        </IconButton>
                    </div>
                </div>

                <div className={styles.conferenceView}>
                    {videos.map((video) => (
                        <RemoteVideo
                            key={video.socketId}
                            video={video}
                            styles={styles}
                            fullScreenVideo={fullScreenVideo}
                            toggleFullScreen={toggleFullScreen}
                        />
                    ))}

                </div>

            </div>

        </div>
    )
}