/**
 * Module dependencies.
 */

var settings = require('./src/util/Settings.js'),
    tests = require('./src/util/tests.js'),
    projects = require('./src/util/projects.js'),
    db = require('./src/util/db.js'),
    express = require("express"),
    socket = require('socket.io'),
    async = require('async'),
    fs = require('fs'),
    http = require('http'),
    https = require('https');
    allClients = {};

/** 
 * SSL Logic and Server bindings
 */ 
if(settings.ssl){
  console.log("SSL Enabled");
  console.log("SSL Key File" + settings.ssl.key);
  console.log("SSL Cert Auth File" + settings.ssl.cert);

  var options = {
    key: fs.readFileSync(settings.ssl.key),
    cert: fs.readFileSync(settings.ssl.cert)
  };
  var app = express(options);
  var server = https.createServer(options, app).listen(settings.port);
}else{
  var app = express();
  var server = app.listen(settings.port, settings.ip);
}

/** 
 * Build Client Settings that we will send to the client
 */
var clientSettings = {
  "tool": settings.tool
}

// Config Express to server static files from /
app.configure(function(){
  app.use(express.static(__dirname + '/'));
});

// Sessions
app.use(express.cookieParser());
app.use(express.session({secret: 'secret', key: 'express.sid'}));

// Development mode setting
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Production mode setting
app.configure('production', function(){
  app.use(express.errorHandler());
});


// Front-end tests
app.get('/tests/frontend/specs_list.js', function(req, res){
  tests.specsList(function(tests){
    res.send("var specs_list = " + JSON.stringify(tests) + ";\n");
  });
});

// Used for front-end tests
app.get('/tests/frontend', function (req, res) {
  res.redirect('/tests/frontend/');
});

// Static files IE Javascript and CSS
app.use("/static", express.static(__dirname + '/src/static'));


// LISTEN FOR REQUESTS
var io = socket.listen(server);
io.sockets.setMaxListeners(0);

// SOCKET IO
io.sockets.on('connection', function (socket) {

  socket.on('disconnect', function () {
    var room = allClients[socket.id]
    projects.projects[room]
    delete projects.projects[room]
    delete allClients[socket.id]
    console.log("Socket disconnected");
  });

  // EVENT: User stops drawing something
  // Having room as a parameter is not good for secure rooms
  socket.on('draw:progress', function (room, start_x, start_y, end_x, end_y) {
    if (!projects.projects[room] || !projects.projects[room].external_paths) {
      loadError(socket);
      return;
    }
    projects.projects[room].external_paths.push([start_x,start_y, end_x, end_y])
    db.storeProject(room);
    io.in(room).emit('draw:progress', start_x, start_y, end_x, end_y);
   });

 
  // User joins a room
  socket.on('subscribe', function(data) {
    subscribe(socket, data);
  });

  // User clears canvas
  socket.on('clear', function(room) {
    if (!projects.projects[room] || !projects.projects[room].project) {
      loadError(socket);
      return;
    }

    io.in(room).emit('clear');
  });

});

// Subscribe a client to a room
function subscribe(socket, roomInput) {
  var room = roomInput;

  // Subscribe the client to the room
  socket.join(room);

  allClients[socket.id] = room ;
 

  var project = projects.projects[room];
  if (!project) {
    console.log("made room");
    projects.projects[room] = {};
    // Use the view from the default project. This project is the default
    // one created when paper is instantiated. Nothing is ever written to
    // this project as each room has its own project. We share the View
    // object but that just helps it "draw" stuff to the invisible server
    // canvas.
    projects.projects[room].external_paths = [];
    db.load(room, socket);
  } else { // Project exists in memory, no need to load from database
    loadFromMemory(room, socket);
  }

  // Broadcast to room the new user count -- currently broken
  var rooms = socket.adapter.rooms[room]; 
  var roomUserCount = Object.keys(rooms).length;
  io.to(room).emit('user:connect', roomUserCount);
}

// Send current project to new client
function loadFromMemory(room, socket) {
  var project = projects.projects[room].external_paths;
  if (!project) { // Additional backup check, just in case
    db.load(room, socket);
    return;
  }else{
    socket.emit('loading:start');
    var value = project
    console.log("Loading from memory")
    socket.emit('project:load', {project: value});
    socket.emit('loading:end');
  }
}

function loadError(socket) {
  socket.emit('project:load:error');
}

