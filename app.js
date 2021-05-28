// server.js
// express initializes variable app to be a function handler that you can supply an HTTP server

// ##############################
// # NODE MODULES               #
// ##############################

const CryptoJS = require("crypto-js");
const express = require('express');

const { groupEnd } = require('console');
const fs = require('fs');
const path = require('path');

const mysql  = require('mysql');



// ##############################
// # DATABASE AUTHENTICATION    #
// ##############################

let databasePasswordPath = path.resolve('../database_pass');
let databasePass = fs.readFileSync(databasePasswordPath, {encoding: 'utf8'});

// ##############################
// # CLIENT-SERVER STATUS CODES #
// ##############################

const LOGGED_IN = 100;
const REGISTERED = 101;
const DISCOVER_BECAME_MEMBER = 102;
const WRONG_CREDENTIALS = 200;
const USER_DOESNT_EXIST = 201;
const USERNAME_BREAKS_RULES = 202;
const PASSWORD_BREAKS_RULES = 203;
const PASSWORD_TOO_WEAK = 204;
const NOT_LOGGED_IN = 205;
const ALREADY_LOGGED_IN = 206;
const USERNAME_TAKEN = 207;
const PRIVATE_GROUP = 208;
const ALREADY_IN_GROUP = 209;
const GROUP_NAME_REQUIRED = 210;
const INVALID_OPTIONS = 211;
const GROUP_NAME_TAKEN = 212;

// ##############################
// # SOCKETS                    #
// ##############################

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http, { path: '/rrchat/socket.io' });
var port = process.env.PORT || 3789;


// route to /views/index.html - defined route handler '/' that gets called when we hit our website home page
app.get('/rrchat', function(req, res) {
	res.sendFile(__dirname + '/views/index.html')
})

app.use('/rrchat/public', express.static('./public'));

let connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: databasePass,
  database: 'chat'
});




// #####################################
// # DATABASE ACCESS                   #
// #####################################


connection.connect(function(err) {
  if (err) {
    return console.error('error: ' + err.message);
  }

  console.log('Connected to the MySQL server.');
});

// ### UTILITIES ###

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// ### AUTHENTICATION ###

// callback(id: number)
function createUser(username, pass, callback) {
  let sql = `INSERT INTO users (name, pass) VALUES(?, AES_ENCRYPT(?, ?))`;

  connection.query(sql, [username, username, pass], (err, result, fields) => {
    if(err) throw err;

    callback(result.insertId);
  });
}

// callback(id: number)
function userExists(username, callback) {
  let sql = `SELECT id FROM users WHERE name=?`;
  console.log(username);

  connection.query(sql, [username], (err, results, fields) => {
    if(err) throw err;

    callback(results.length > 0 ? results[0].id : 0);
  });
}

// callback(match: bool)
function checkPassword(id, username, password, callback) {
  let sql = `SELECT * FROM users WHERE id=? AND pass=AES_ENCRYPT(?, ?)`;

  connection.query(sql, [id, username, password], (err, results, fields) => {
    if(err) throw err;

    callback(results.length > 0);
  });
}



// ### USER DATA FOR GUI ###

// callback(groups: string[])
function getGroupNames(id, callback) {
  let sql = `SELECT chats.name FROM members INNER JOIN chats ON members.chat=chats.id WHERE user=?`;

  connection.query(sql, [id], (err, results, fields) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(groups: number[])
function getGroupIDs(id, callback) {
  let sql = `SELECT chats.id FROM members INNER JOIN chats ON members.chat=chats.id WHERE user=?`;

  connection.query(sql, [id], (err, results, fields) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(members: string[])
function getGroupMembers(id, callback) {
  let sql = `SELECT users.name FROM members INNER JOIN users ON members.user=users.id WHERE members.chat=?`;

  connection.query(sql, [id], (err, results, fields) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(groups: [{id, name}, ..])
function getGroups(userID, callback) {
  let sql = `SELECT chats.id, chats.name FROM members INNER JOIN chats ON members.chat=chats.id WHERE user=?`;

  connection.query(sql, [userID], (err, results, fields) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(groups: [{id, name, message}, ..])
function getGroupsFeed(userID, callback) {
  let sql = `
  SELECT chats.id, chats.name, package.content 
  FROM chats 
  INNER JOIN (
    SELECT members.chat, latest.content 
    FROM members 
    LEFT JOIN (
      SELECT o.chat, o.content 
      FROM \`messages\` o 
      LEFT JOIN \`messages\` b 
      ON o.chat = b.chat AND o.timestamp < b.timestamp 
      WHERE b.timestamp is NULL 
    ) AS latest 
    ON members.chat=latest.chat 
    WHERE members.user=?
  ) AS package 
  ON chats.id=package.chat`;

  connection.query(sql, [userID], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(name, id, message)
function getGroupFeedEntry(chatID, callback) {
  let sql = `
  SELECT chats.id, chats.name, line.content 
  FROM chats 
  LEFT JOIN (
    SELECT o.chat, o.content 
    FROM \`messages\` o 
    LEFT JOIN \`messages\` b 
    ON o.chat = b.chat 
    AND o.timestamp < b.timestamp 
    WHERE b.timestamp is NULL AND o.chat = ?
  ) AS line 
  ON chats.id = line.chat 
  WHERE chats.id = ?`;

  connection.query(sql, [chatID, chatID], (err, results) => {
    if(err) throw err;

    console.log("group feed entry", results);

    callback(results.length > 0 ? results[0] : null);
  });
}

// callback(chatID)
function getInvitationChatID(invitationID, callback) {
  let sql = `SELECT chat FROM invitations WHERE id=?`;

  connection.query(sql, [invitationID], (err, results) => {
    if(err) throw err;

    callback(results.length > 0 ? results[0].chat : 0);
  });
}

// callback(invitations: [id, inviter, groupID])
function getInvitations(userID, callback) {
  let sql = `
  SELECT invitations.id, user.name AS inviter, line.name AS \`group\` 
  FROM invitations 
  INNER JOIN (
    SELECT * 
    FROM chats
  ) AS line
  ON invitations.chat=line.id 
  INNER JOIN (
    SELECT * 
    FROM users
  ) AS user
  ON inviter=user.id 
  WHERE invited=? 
  ORDER BY timestamp DESC`;

  connection.query(sql, [userID], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(success: bool)
function deleteInvitation(invitationId, callback) {
  let sql = `DELETE FROM invitations WHERE id=?`;
  connection.query(sql, [invitationId], (err, results) => {
    if(err) throw err;

    callback(results.affectedRows > 0);
  });
}

// ### GETTERS AND SETTERS ###

// callback(name)
function getUserName(userID, callback) {
  let sql = `select users.name from users where id=?`;

  connection.query(sql, [userID], (err, results) => {
    if(err) throw err;

    callback(results.length == 1 ? results[0]["name"] : null);
  });
}

// callback(name)
function getGroupName(groupID, callback) {
  let sql = `select chats.name from chats where id=?`;

  connection.query(sql, [groupID], (err, results) => {
    if(err) throw err;

    callback(results.length == 1 ? results[0]["name"] : null);
  });
}

// callback(id)
function getGroupID(groupName, callback) {
  let sql = `select id from chats where name=?`;

  connection.query(sql, [groupName], (err, results) => {
    if(err) throw err;

    callback(results.length == 1 ? results[0]["id"] : null);
  });
}

// callback(public: bool)
function isGroupPublic(groupID, callback) {
  let sql = `select id from chats where id=? and chats.public=true`;

  connection.query(sql, [groupID], (err, results) => {
    if(err) throw err;

    callback(results.length == 1);
  });
}

// callback(taken: bool)
function isGroupNameTaken(groupName, callback) {
  let sql = `SELECT * FROM chats WHETE name=?`;

  connection.query(sql, [groupName], (err, results) => {
    if(err) throw err;

    callback(results.length == 1);
  });
}

// callback(is: bool)
function isInvited(invitationID, invitedID, callback) {
  let sql = `SELECT * FROM invitations WHERE id=? AND invited=?`;

  connection.query(sql, [invitationID, invitedID], (err, results) => {
    if(err) throw err;

    callback(results.length == 1);
  });
}

// ### COMMUNICATION ###

// callback(response: number)
function createGroup(data) {
  let sql = `INSERT INTO chats (name, admin, public, requestToJoin, othersCanInvite) values(?)`;
}

// callback(belongs: bool)
function belongsInGroup(userID, groupID, callback) {
  let sql = `select * from members where user=? and chat=?`;

  connection.query(sql, [userID, groupID], (err, results) => {
    if(err) throw err;
    
    callback(results.length == 1 ? results[0] : null);
  });
}

// callback(messageID: number)
function storeMessage(senderID, chatID, content, callback) {
  content = escapeHtml(content);

  let sql = `insert into messages (sender, chat, content) values(?, ?, ?)`;

  connection.query(sql, [senderID, chatID, content], (err, results) => {
    if(err) throw err;
    
    callback(results.insertId);
  });
}

// callback(data: Object[])
function getMessage(messageID, callback) {
  let sql = `select * from messages where id=?`;

  connection.query(sql, [messageID], (err, results) => {
    if(err) throw err;
    
    callback(results.length > 0 ? results : null);
  });
}

// callback(data: Object)
function sendMessage(senderID, chatID, content, callback) {
  storeMessage(senderID, chatID, content, (messageID) => {
    getMessage(messageID, (data) => {
      getUserName(data[0]["sender"], (sender) => {
        callback({
            "sender": sender, 
            "content": data[0]["content"], 
            "timestamp": data[0]["timestamp"]
          });
      });
    });
  });
}

// callback(groups: {id, name}[])
function listPublicGroups(userID, callback, limit = 30) {
  let sql = `
    SELECT chats.id, chats.name, IFNULL(line.isMember,0) AS isMember, second.members 
    FROM chats 
    LEFT JOIN (
      SELECT 1 AS isMember, members.chat 
      FROM members 
      WHERE members.user=?
    ) AS line 
    ON chats.id=line.chat 
    LEFT JOIN (
      SELECT chats.id, IFNULL(num.num,0) AS members 
      FROM chats 
      LEFT JOIN (
        SELECT chat, count(*) AS num 
        FROM members 
        GROUP BY chat
      ) AS num 
      ON num.chat=chats.id
      WHERE chats.public=TRUE
    ) AS second ON chats.id=second.id
    WHERE chats.public=TRUE ORDER BY members DESC LIMIT ?;`;

  connection.query(sql, [userID, limit], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(groups: {id, name}[])
function searchPublicGroups(userID, search, callback, start = 0, limit = 30) {
  let sql = `
    SELECT chats.id, chats.name, IFNULL(line.isMember,0) AS isMember, second.members 
    FROM chats 
    LEFT JOIN (
      SELECT 1 AS isMember, members.chat 
      FROM members 
      WHERE members.user=?
    ) AS line 
    ON chats.id=line.chat 
    LEFT JOIN (
      SELECT chats.id, IFNULL(num.num,0) AS members 
      FROM chats 
      LEFT JOIN (
        SELECT chat, count(*) AS num 
        FROM members 
        GROUP BY chat
      ) AS num 
      ON num.chat=chats.id
      WHERE chats.public=TRUE
    ) AS second ON chats.id=second.id
    WHERE chats.public=TRUE AND name LIKE ? ORDER BY members DESC LIMIT ?,?;`;

  // Don't allow underscores nor question marks
  search = search.replace('_', "\\_").replace('%', "\\%");

  connection.query(sql, [userID, "%"+search+"%", start, limit], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(response: number)
function requestMember(userID, groupID, callback) {
  belongsInGroup(userID, groupID, (belongs) => {
    if(belongs) {
      callback(PRIVATE_GROUP);
    } else {
      let sql = `INSERT INTO members (user, chat) values(?, ?);`;

      connection.query(sql, [userID, groupID], (err, results) => {
        if(err) throw err;

        callback(DISCOVER_BECAME_MEMBER);
      });
    }
  });
}

function addIntoGroup(userID, groupID) {
  let sql = `INSERT INTO members (user, chat) values(?, ?);`;

  connection.query(sql, [userID, groupID], (err, results) => {
    if(err) throw err;
  });
}

function printChatHistory(socket, chatID, start = 0, limit = 100) {
  let sql = `
  SELECT messages.id, messages.content_type, messages.content, UNIX_TIMESTAMP(messages.timestamp) AS timestamp, users.name 
  FROM messages 
  INNER JOIN users 
  ON messages.sender=users.id 
  WHERE messages.chat=? AND UNIX_TIMESTAMP( messages.timestamp) > ?
  ORDER BY messages.id DESC LIMIT ?`;

  connection.query(sql, [chatID, start, limit], (err, results) => {
    if(err) throw err;

    results.reverse();
    
    results.forEach((message) => {
      socket.emit('chat message', {
        "id": message["id"],
        "content_type": message["content_type"],
        "content": message["content"],
        "timestamp": message["timestamp"],
        "sender": message["name"]
      });
    });
  });
}


// ###################################
// # EVENT HANDLING                  #
// ###################################

function broadcastMessage(senderID, chatID, content) {
  sendMessage(senderID, chatID, content, (data) => {
    let name = "group"+chatID;
    io.to(name).emit('chat message', data);
  });
}

// we can send the event to everyone using emit. 
io.on('connection', function(socket){
  var clientIp = socket.request.connection.remoteAddress;
  
  let sender = clientIp.replace("::ffff:", "");
  
  let loggedIn = false;
  let nickname = '';
  let userID = 0;
  let currentRoom = null;
  let chatID = 0;

  socket.on('join', function() {

  });

  socket.on('logout', function() {
    socket.leave(currentRoom);
    
    loggedIn = false;
    nickname = '';
    userID = 0;
    currentRoom = null;
    chatID = 0;
  });

  socket.on('register', function(username, pass) {  
    if(loggedIn) {
      socket.emit('response', ALREADY_LOGGED_IN);
      return;
    }

    userExists(username, (id) => {
      if(id != 0) {
        socket.emit('response', USERNAME_TAKEN);
        return;
      }

      createUser(username, pass, (id) => {
        loggedIn = true;
        nickname = username;
        userID = id;

        socket.emit('response', REGISTERED, { "nickname": nickname });

        // send all groups
        getGroupsFeed(userID, (list) => {
          socket.emit('data', "groups", list);
        });
      });
    });
  });

  socket.on('login', function(username, pass) {  
    if(loggedIn) {
      socket.emit('response', ALREADY_LOGGED_IN);
      return;
    }

    userExists(username, (id) => {
      if(id == 0) {
        socket.emit('response', USER_DOESNT_EXIST);
        return;
      }

      console.log("id check passed");

      checkPassword(id, username, pass, (match) => {
        if(!match) {
          socket.emit('response', WRONG_CREDENTIALS);
          return;
        }
        console.log("logged in");

        loggedIn = true;
        nickname = username;
        userID = id;

        socket.emit('response', LOGGED_IN, { "nickname": nickname });

        // send all groups
        getGroupsFeed(userID, (list) => {
          socket.emit('data', "groups", list);
        });

        // send all invitations
        getInvitations(userID, (list) => {
          socket.emit('data', "invitations", list);
        });
      })
    });
  });

  socket.on('get', function(label) {
    if(!loggedIn) {
      socket.emit('response', NOT_LOGGED_IN);
      return;
    }

    switch (label) {
      case "groups":
        getGroupNames(userID, (list) => {
          socket.emit('data', label, list);
        });
        break;
      case "members":
        getGroupMembers(chatID, (list) => {
          socket.emit('data', label, list);
        });
        break;
    
      default:
        socket.emit('data', label, null);
        break;
    }
  });

  socket.on('chat message', function(msg) {
    if(!loggedIn) {
      socket.emit('response', NOT_LOGGED_IN);
      return;
    }

    broadcastMessage(userID, chatID, msg);
  });

  socket.on('do', function(command, data) {
    if(!loggedIn) {
      socket.emit('response', NOT_LOGGED_IN);
      return;
    }

    switch (command) {
      case "go":
        console.log("do.go 1");
        if(!data["group"]) return;
        console.log("do.go 2");

        belongsInGroup(userID, data["group"], (belongs) => {
          console.log("do.go 3");
          if(belongs) {
            console.log("do.go 4");
            chatID = data["group"];
            
            if(currentRoom != null) socket.leave(currentRoom);
            currentRoom = "group" + data["group"];
            socket.join(currentRoom);
            
            getGroupName(data["group"], (name) => {
              console.log("sending '"+nickname+"' to: ", name);
              socket.emit('do', "change group", { "name": name });

              printChatHistory(socket, chatID);
            });
          }
        });
        break;
        case "discover":
          console.log(data);
          if(data) {
            if(data["search"] && data["search"] != null) {
              searchPublicGroups(userID, data["search"], (data) => {
                socket.emit('data', "discover", data);
              }, data["start"] ? data["start"] : 0);
            } else {
              listPublicGroups(userID, (data) => {
                socket.emit('data', "discover", data);
              });
            }
          }
          break;
        case "request-member":
          if(!data || !data["id"]) break;

          belongsInGroup(userID, data["id"], (belongs) => {
            if(belongs) {
              socket.emit('response', ALREADY_IN_GROUP);
              return;
            }

            isGroupPublic(data["id"], (isPublic) => {
              if(!isPublic) {
                socket.emit('response', PRIVATE_GROUP);
                return;
              }

              requestMember(userID, data["id"], (response) => {
                socket.emit('response', response, { "id": data["id"] });
              });
            });
          });
          break;
        case "create-group":
          if(!data) break;

          // Check data
          if(!data["name"] || data["name"].length == 0) {
            socket.emit('response', GROUP_NAME_REQUIRED);
            break;
          }

          if(data["public"] == true && data["others-can-invite"] == true) {
            socket.emit('response', INVALID_OPTIONS);
            break;
          }

          if(data["public"] == false && data["request-to-join"] == false) {
            socket.emit('response', INVALID_OPTIONS);
            break;
          }

          // If name isn't taken
          isGroupNameTaken(data["name"], (taken) => {
            if(taken) {
              socket.emit('response', GROUP_NAME_TAKEN);
              return;
            }

            createGroup(data, (response) => {
              socket.emit('response', response);
            });
          });

          break;
        case "accept-invite":
          if(!data) break;
          if(!data["id"]) break;

          isInvited(data["id"], userID, (id) => {
            if(!id) return;

            getInvitationChatID(data["id"], (chatID) => {
              deleteInvitation(data["id"], (success) => {
                addIntoGroup(userID, chatID);

                getGroupFeedEntry(chatID, (feedEntry) => {
                  socket.emit('data', "groups", [feedEntry]);
                });
              });
            });
          });
      default:
        break;
    }
  });
});




// http server listening for requests on port 3789
http.listen(port, function(){
  console.log('listening on *:3789');
})
