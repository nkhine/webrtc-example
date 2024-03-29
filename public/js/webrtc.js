/////////////////////////////////////////////////////////////////
// Javascript file used to make a visio call between 2 clients //
/////////////////////////////////////////////////////////////////

//-- Global variables declarations--//
var localVideo;
var remoteVideo;
var status;  
var guest;
var message;
var url;
var localStream;
var started = false; 
var channelReady = false;
var pc;
var socket;
var room;

/**
 * The first function to be launched
 * @return {void}
 */
initialize = function() {
    console.log("Initializing");
    localVideo = $("#localVideo");
    remoteVideo = $("#remoteVideo");
    status = $("#status");
    openChannel();
    getUserMedia();
}

/**
 * Allow to reset the status in the footer
 * @return {void}
 */
resetStatus = function() {
    
    /**
     * if you aren't the guest it provides you a link to invite someone in the footer
     */
    if (!guest) {
        setStatus("<div class=\"alert\">Waiting for someone to join: <a href=\""+window.location.href+"?room="+room+"\">"+window.location.href+"?room="+room+"</a></div>");
    } else {
        setStatus("Initializing...");
    }
}

/**
 * Set the footer
 * @param {string} state : string to be placed in the footer
 */
setStatus = function(state) {
    $('#footer').html(state);
}

/**
 * Declare the socket (websocket) and open it
 * declare the event attached to the socket
 * @return {void}
 */
openChannel = function() {
    // socket = io.connect('http://localhost:19859/');
    socket = io.connect('http://webrtcexample.nodester.com');

    socket
      .on('connect', onChannelOpened)
      .on('message', onChannelMessage)
      .on('error', onChannelError)
      .on('bye', onChannelBye)
      .on('close', onChannelClosed)
      .on('recupererMessages', recupererMessages)
      .on('recupererNouveauMessage', recupererNouveauMessage)
      .on('prevSlide', remotePrev)
      .on('nextSlide', remoteNext);
     
    /**
     * search the url address for the parameter room
     * if it exists it means you are a guest and you don't need to request a room number
     */ 
    if(location.search.substring(1,5) == "room") {
      room = location.search.substring(6);
      socket.emit("invite", room);
      guest =1;
    } else {
      socket.on('getRoom', function(data){
        room = data.roomId;
        console.log(room);
        resetStatus();
        guest = 0;
      });
    }
}

/**
 * get the media (audio or video) of the user
 * @return {void}
 */
getUserMedia = function() {
    try {
      navigator.webkitGetUserMedia({audio:true, video:true}, onUserMediaSuccess,
                                   onUserMediaError);
      console.log("Requested access to local media with new syntax.");
    } catch (e) {
      try {
        navigator.webkitGetUserMedia("video,audio", onUserMediaSuccess,
                                     onUserMediaError);
        console.log("Requested access to local media with old syntax.");
      } catch (e) {
        alert("webkitGetUserMedia() failed. Is the MediaStream flag enabled in about:flags?");
        console.log("webkitGetUserMedia failed with exception: " + e.message);
      }
    }
}

/**
 * Callback function for getUserMedia() on success getting the media
 * create an url for the current stream
 * @param  {stream} stream : contains the video and/or audio streams
 * @return {void}
 */
onUserMediaSuccess = function(stream) {
    console.log("User has granted access to local media.");
    url = webkitURL.createObjectURL(stream);
    localVideo.css("opacity", "1");
    $("#locallive").removeClass('hide');
    localVideo.attr("src", url);
    localStream = stream;   
    if (guest) maybeStart();    
}

/**
 * Callback function for getUserMedia() on fail getting the media
 * @param  {error} error : informations about the error
 * @return {void}
 */
onUserMediaError = function(error) {
    console.log("Failed to get access to local media. Error code was " + error.code);
    alert("Failed to get access to local media. Error code was " + error.code + ".");    
}

/**
 * Verify all parameters and start the peer connection and add the stream to this peer connection
 * @return {void}
 */
maybeStart = function() {
    if (!started && localStream && channelReady) {      
        setStatus("Connecting..."); 
        console.log("Creating PeerConnection.");
        createPeerConnection();  
        console.log("Adding local stream.");      
        pc.addStream(localStream);
        started = true;
    }
}

/**
 * Set parameter for creating a peer connection and add a callback function for messagin by peer connection
 * @return {void}
 */
createPeerConnection = function() {
  if(typeof webkitPeerConnection === 'function')
    // pc = new webkitPeerConnection("NONE", onSignalingMessage);  
    pc = new webkitPeerConnection("STUN stun.1.google.com:19302", onSignalingMessage);  
    // pc = new webkitPeerConnection("TURN 123.123.123.123:12345", onSignalingMessage);  
  else
    // pc = new webkitDeprecatedPeerConnection("NONE", onSignalingMessage);
    pc = new webkitDeprecatedPeerConnection("STUN stun.1.google.com:19302", onSignalingMessage);
    // pc = new webkitDeprecatedPeerConnection("TURN 123.123.123.123:12345", onSignalingMessage);
  pc.onconnecting = onSessionConnecting;
  pc.onopen = onSessionOpened;
  pc.onaddstream = onRemoteStreamAdded;
  pc.onremovestream = onRemoteStreamRemoved;  
}

/**
 * Function called by the peerConnection method for the signaling process between clients
 * @param  {message} message : generated by the peerConnection API to send SDP message
 * @return {void}
 */
onSignalingMessage = function(message) {      
    console.log("onSignalingMessage " + message);
    socket.send(message);
}

/**
 * Call when the user click on the "Hang Up" button
 * Close the peerconnection and tells to the websocket server you're leaving
 * @return {void}
 */
onHangup = function() {
    console.log("Hanging up.");    
    localVideo.css("opacity", "0");    
    remoteVideo.css("opacity", "0");
    $("#locallive").addClass('hide');
    $("#remotelive").addClass('hide');    
    pc.close();
    pc = null;
    socket.emit("exit");
    setStatus("<div class=\"alert alert-info\">You have left the call.</div>");    
}

/**
 * Called when the channel with the server is opened
 * if you're the guest the connection is establishing by calling maybeStart()
 * @return {void}
 */
onChannelOpened = function() {    
    console.log('Channel opened.');
    channelReady = true;
    if (guest) maybeStart();
}

/**
 * Called when the client receive a message from the websocket server
 * @param  {message} message : SDP message
 * @return {void}
 */
onChannelMessage = function(message) {
    console.log('S->C: ' + message);
    if (message.indexOf("\"ERROR\"", 0) == -1) {        
        if (!guest && !started) maybeStart();
        pc.processSignalingMessage(message);    
    }
}

/**
 * Called when the other client is leaving
 * @return {void}
 */
onChannelBye = function() {
    console.log('Session terminated.');    
    remoteVideo.css("opacity", "0");
    $("#remotelive").addClass('hide');
    //remoteVideo.attr("src",null);
    guest = 0;
    started = false;
    setStatus("<div class=\"alert alert-info\">Your partner have left the call.</div>");
}

/**
 * log the error
 * @return {void}
 */
onChannelError = function() {    
    console.log('Channel error.');
}

/**
 * log that the channel is closed
 * @return {[type]}
 */
onChannelClosed = function() {    
    console.log('Channel closed.');
}

/**
 * Called when the peer connection is connecting
 * @param  {message} message
 * @return {void}
 */
onSessionConnecting = function(message) {      
    console.log("Session connecting.");
}

/**
 * Called when the session between clients is established
 * @param  {message} message
 * @return {void}
 */
onSessionOpened = function(message) {      
    console.log("Session opened.");
}

/**
 * Get the remote stream and add it to the page with an url
 * @param  {event} event : event given by the browser
 * @return {void}
 */
onRemoteStreamAdded = function(event) {   
    console.log("Remote stream added.");
    url = webkitURL.createObjectURL(event.stream);
    remoteVideo.css("opacity", "1");
    $("#remotelive").removeClass('hide');
    remoteVideo.attr("src",url);
    setStatus("<div class=\"alert alert-success\">Is currently in video conference <button id=\"hangup\" class=\"btn btn-mini btn-danger pull-right\" onclick=\"onHangup()\">Hang Up</button></div>");
}

/**
 * Called when the remote stream has been removed
 * @param  {event} event : event given by the browser
 * @return {void}
 */
onRemoteStreamRemoved = function(event) {   
    console.log("Remote stream removed.");
}