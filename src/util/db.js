var settings = require('./Settings.js'),
    projects = require('./projects.js'),
     ueberDB = require('ueberDB')

// Database connection
var db = new ueberDB.database(settings.dbType, settings.dbSettings);

// Init..
db.init(function(err){
  if(err){
    console.error(err);
  }
});

// Write to teh database
exports.storeProject = function(room) {
  var project = projects.projects[room].external_paths;
  db.set(room, {project: project});
}

function loadError(socket) {
  socket.emit('project:load:error');
}


// Try to load room from database
exports.load = function(room, socket) {
  if (projects.projects[room] && projects.projects[room].external_paths) {
    var project = projects.projects[room].external_paths;
    db.get(room, function(err, value) { 
       if( value != null){
        projects.projects[room].external_paths = value["project"]
        socket.emit('project:load', value);
       }
    });
   } else {
    loadError(socket);
  }
}

exports.db = db;
