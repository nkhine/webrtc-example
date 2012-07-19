///////////////////////////////////
// Server Node.js with socket.IO //
///////////////////////////////////

/**
 * Declare the server HTTP
 * listen to the port 19859
 */
var PORT = 19859;

var express = require('express')
  , http = require('http');

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(process.env['app_port'] || PORT);
console.log('Listening on port ' + PORT);

// config
app.set('views', __dirname + '/views');
// app.set('view engine', 'jade');

// middleware
app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.logger());
  app.use(express.static(__dirname + '/public'));
});

// routes

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/views/index.html');
});


/**
 * Declare the variable messages for the chat
 */
var messages = new Array();

/**
* When a user connects
*/
io.sockets.on('connection', function (client) {

	//-- Variables declarations--//
	var guest = false;
	var room = '';

	/**
	 * When a user is invited
	 * join the room
	 * @param {int} invitation : room number
	 */
	client.on("invite", function(invitation){
		room = invitation;
		guest = true;
		client.join(room);
		messages[room] = new Array();
	});

	/**
	 * If you are the first user to connect 
	 * create room
	 */
	if(!guest){
		room = Math.floor(Math.random()*1000001).toString();
		client.emit('getRoom', {roomId : room});
		client.join(room);
		messages[room] = new Array();
	}

	/**
	 * When a user send a SDP message
	 * broadcast to all users in the room
	 */
  	client.on('message', function(message) {
        var broadcastMessage = message;
        client.broadcast.to(room).send(broadcastMessage);
    });

    /**
	 * When a user changes for a next slide
	 * broadcast to all users in the room
	 */
    client.on('prevSlide', function() {
    	client.broadcast.to(room).emit('prevSlide');
    });

    /**
	 * When a user changes for a previous slide
	 * broadcast to all users in the room
	 */
    client.on('nextSlide', function() {
    	client.broadcast.to(room).emit('nextSlide');
    });

    /**
	 * List of messages (chat)
	 */
	client.emit('recupererMessages', messages[room]);

	/**
	 * When we receive a new message (chat)
	 * add to the array
	 * broadcast to all users in the room
	 */
	client.on('nouveauMessage', function (mess) {
		messages[room].push(mess);
		client.broadcast.to(room).emit('recupererNouveauMessage', mess);
	});

	/**
	 * When the user hang up
	 * broadcast bye signal to all users in the room
	 */
 	client.on('exit',function(){
    	client.broadcast.to(room).emit('bye');
  	});

  	/**
	 * When the user close the application
	 * broadcast close signal to all users in the room
	 */
  	client.on('disconnect',function(){
    	client.broadcast.to(room).emit('close');
  	});
});