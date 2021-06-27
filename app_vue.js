/* eslint-disable */
// server.js
// express initializes variable app to be a function handler that you can supply an HTTP server

// ##############################
// # NODE MODULES               #
// ##############################

const typeCheck = require("type-check").typeCheck;
const express = require('express');

const { groupEnd } = require('console');
const fs = require('fs');
const path = require('path');

const mysql  = require('mysql');

const options = {
  customTypes: {
    ValidString: {
      typeOf: 'String',
      validate: function(x) {
        return x.length > 0;
      }
    }
  }
};

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
var io = require('socket.io')(http, { path: '/rrchat/socket.io', origins: '*:*' });
var port = process.env.PORT || 3789;


app.get('/rrchat/dev', function(req, res) {
	res.sendFile(__dirname + '/views/vue.html')
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

// callback(isPublic)
function isGroupPublic(chatID, callback) {
  let sql = `SELECT public FROM chats WHERE id=?;`;

  connection.query(sql, [userID], (err, results, fields) => {
    if(err) throw err;
    
    if(results.length > 0) {
      callback(results[0]["public"]); 
    }
  });
}

// callback(requestToJoin)
function isGroupRequestToJoin(chatID, callback) {
  let sql = `SELECT requestToJoin FROM chats WHERE id=?;`;

  connection.query(sql, [userID], (err, results, fields) => {
    if(err) throw err;
    
    if(results.length > 0) {
      callback(results[0]["requestToJoin"]); 
    }
  });
}

// callback(groups: [{id, name, message}, ..])
function getGroupsFeed(userID, callback) {
  let sql = `
  SELECT chats.id, chats.name, package.content as message, LEAST(UNIX_TIMESTAMP(chats.created), UNIX_TIMESTAMP(package.timestamp)) AS timestamp
  FROM chats 
  INNER JOIN (
    SELECT members.chat, latest.content, latest.timestamp
    FROM members 
    LEFT JOIN (
      SELECT o.chat, o.content, o.timestamp
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
function getGroupsFeedEntry(chatID, callback) {
  let sql = `
  SELECT chats.id, chats.name, line.content as message, LEAST(UNIX_TIMESTAMP(chats.created), UNIX_TIMESTAMP(line.timestamp)) AS timestamp
  FROM chats 
  LEFT JOIN (
    SELECT o.chat, o.content, o.timestamp
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

// callback(taken: bool)
function isGroupNameTaken(groupName, callback) {
  let sql = `SELECT * FROM chats WHERE name=?`;

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

// callback(requests: [id, requester, group, groupID])
function getRequests(userID, callback) {
  let sql = `
  SELECT requests.id, asker.name AS requester, line.name AS \`group\`, chat AS \`groupID\` 
  FROM requests 
  INNER JOIN (
    SELECT * 
    FROM chats
  ) AS line
  ON requests.chat=line.id 
  INNER JOIN (
    SELECT * 
    FROM users
  ) AS asker
  ON user=asker.id 
  WHERE chat=? 
  ORDER BY timestamp DESC`;

  connection.query(sql, [userID], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// ### COMMUNICATION ###

// callback(inserID: number)
function createGroup(name, admin, isPublic, requestToJoin, callback) {
  let sql = `INSERT INTO chats (name, admin, public, requestToJoin) values(?, ?, ?, ?)`;

  connection.query(sql, [name, admin, isPublic, requestToJoin], (err, results) => {
    if(err) throw err;
    
    callback(results.insertId);
  });
}

// callback(belongs: bool)
function belongsInGroup(userID, groupID, callback) {
  let sql = `SELECT * FROM members WHERE user=? AND chat=?`;

  connection.query(sql, [userID, groupID], (err, results) => {
    if(err) throw err;
    
    callback(results.length == 1 ? results[0] : null);
  });
}

// callback(messageID: number)
function storeMessage(senderID, chatID, content, content_type, callback) {
  content = escapeHtml(content);

  let sql = `insert into messages (sender, chat, content, content_type) values(?, ?, ?, ?)`;
  
  connection.query(sql, [senderID, chatID, content, content_type], (err, results) => {
    if(err) throw err;
    
    callback(results.insertId);
  });
}

// callback(data: Object[])
function getMessage(messageID, callback) {
  let sql = `select id, sender, chat, content_type, content, UNIX_TIMESTAMP(timestamp) AS timestamp from messages where id=?`;

  connection.query(sql, [messageID], (err, results) => {
    if(err) throw err;
    
    callback(results.length > 0 ? results : null);
  });
}

// callback(data: Object)
function sendMessage(senderID, chatID, content, content_type, callback) {
  storeMessage(senderID, chatID, content, content_type, (messageID) => {
    getMessage(messageID, (insertedMessages) => {
      getUserName(insertedMessages[0]["sender"], (sender) => {
          callback({
            "sender": sender, 
            "senderID": insertedMessages[0]["sender"], 
            "chat": insertedMessages[0]["chat"], 
            "content": insertedMessages[0]["content"], 
            "content_type": insertedMessages[0]["content_type"], 
            "timestamp": insertedMessages[0]["timestamp"]
          });
      });
    });
  });
}

// callback(groups: {id, name}[])
function listPublicGroups(userID, callback, start = 0, limit = 30) {

  let sql = `
    SELECT chats.id, chats.name, IFNULL(line.isMember,0) AS isMember, second.members, chats.public, chats.requestToJoin, EXISTS(
        SELECT id FROM requests WHERE requests.user=? AND requests.chat=chats.id
    ) AS requested 
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
    ) AS second 
    ON chats.id=second.id
    WHERE chats.public=TRUE AND chats.created > ? ORDER BY chats.created DESC LIMIT ?;
  `;

  //let sql = `
  //  SELECT id, name, line.timestamp 
  //  FROM chats 
  //  LEFT JOIN (
  //    SELECT chat, UNIX_TIMESTAMP(messages.timestamp) AS timestamp
  //    FROM messages 
  //    GROUP BY chat
  //  ) AS line
  //  ON line.chat=id 
  //  WHERE public=1 AND (line.timestamp<? OR line.timestamp IS NULL)
  //  ORDER BY timestamp 
  //  DESC;
  //`;

  connection.query(sql, [userID, userID, start, limit], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(groups: {id, name, isMember, numMembers}[])
function searchPublicGroups(userID, search, callback, start = 0, limit = 30) {
  /*let sql = `
    SELECT chats.id, chats.name, IFNULL(line.isMember,0) AS isMember, second.members, chats.public, chats.requestToJoin
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
    WHERE chats.public=TRUE AND name LIKE ? ORDER BY members DESC LIMIT ?,?;`;*/


  let sql = `
    SELECT chats.id, chats.name, IFNULL(line.isMember,0) AS isMember, second.members, chats.public, chats.requestToJoin, EXISTS(
        SELECT id FROM requests WHERE requests.user=? AND requests.chat=chats.id
    ) AS requested 
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
    ) AS second 
    ON chats.id=second.id
    WHERE chats.public=TRUE AND name LIKE ? AND chats.created > ? ORDER BY chats.created DESC LIMIT ?;
  `;
  
  // Escape underscores and question marks
  search = search.replace('_', "\\_").replace('%', "\\%");

  connection.query(sql, [userID, userID, "%"+search+"%", start, limit], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}

// callback(response: number)
function requestMember(userID, groupID, callback) {
  belongsInGroup(userID, groupID, (belongs) => {
    if(belongs) {
      callback(ALREADY_IN_GROUP);
    } else {
      let sql = `INSERT INTO members (user, chat) values(?, ?);`;

      connection.query(sql, [userID, groupID], (err, results) => {
        if(err) throw err;

        callback(DISCOVER_BECAME_MEMBER);
      });
    }
  });
}

function addIntoGroup(userID, groupID, callback) {
  let sql = `INSERT INTO members (user, chat) values(?, ?);`;

  connection.query(sql, [userID, groupID], (err, results) => {
    if(err) throw err;
    
    callback();
  });
}

function printChatHistory(chatID, callback, start = 0, limit = 100) {
  let sql = `
  SELECT messages.id, messages.content_type AS type, messages.content, UNIX_TIMESTAMP(messages.timestamp) AS timestamp, users.name AS sender, messages.sender AS senderID
  FROM messages 
  INNER JOIN users 
  ON messages.sender=users.id 
  WHERE messages.chat=? AND UNIX_TIMESTAMP( messages.timestamp) > ?
  ORDER BY messages.id DESC LIMIT ?`;

  connection.query(sql, [chatID, start, limit], (err, results) => {
    if(err) throw err;

    callback(results);
  });
}


// ###################################
// # EVENT HANDLING                  #
// ###################################

function broadcastMessage(senderID, chatID, content, content_type) {
  sendMessage(senderID, chatID, content, content_type, (data) => {
    let name = "chat"+chatID;
    io.to(name).emit('messages', data);
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

  // If user changes chat, the first messages that will be sent will overwrite last messages but 
  // the following messages will be appended
  let appendMessages = false;

  socket.on('logIn', (data) => {
    if(!typeCheck('{ username: ValidString, password: ValidString }', data, options)) {
      return;
    }

    if(loggedIn) {
      socket.emit('loggedIn', {
        "message": "Already logged in"
      });
    }

    userExists(data["username"], (id) => {
      if(id == 0) {
        socket.emit('loggedIn', {
          "message": "User doesn't exist"
        });
        return;
      }

      checkPassword(id, data["username"], data["password"], (match) => {
        if(!match) {
          socket.emit('loggedIn', {
            "message": "Wrong password"
          });
          return;
        }

        loggedIn = true;
        nickname = data["username"];
        userID = id;

        socket.emit('loggedIn', {
          "nickname": nickname,
          "userID": userID
        });
      })
    });
  });

  socket.on('logOut', () => {
    if(!loggedIn) {
      return;
    }

    socket.emit('loggedOut');

    loggedIn = false;
    nickname = '';
    userID = 0;
    currentRoom = null;
    chatID = 0;
  });

  socket.on('disconnect', () => {
    loggedIn = false;
    nickname = '';
    userID = 0;
    currentRoom = null;
    chatID = 0;
  });

  socket.on('groupsFeed', (data) => {
    if(!loggedIn) {
      return;
    }

    if(data && "oldestTimestamp" in data) {
      if(!typeCheck('{ oldestTimestamp: Number }', data)) {
        return;
      }
      
      getGroupsFeed(userID, (groups) => {
        socket.emit('groupsFeed', {
          "append": false,
          "groups": groups
        });
      });
    } else {

      // TODO: return everything after "oldestTimestamp"
      getGroupsFeed(userID, (groups) => {
        socket.emit('groupsFeed', {
          "append": false,
          "groups": groups
        });
      });
    }
  });

  socket.on('invitationsFeed', (data) => {
    if(!loggedIn) {
      return;
    }

    if(data && "oldestTimestamp" in data) {
      if(!typeCheck('{ oldestTimestamp: Number }', data)) {
        return;
      }
      
      getInvitations((invitations) => {
        socket.emit('invitationsFeed', {
          "append": false,
          "invitations": invitations
        });
      });
    } else {

      // TODO: return everything after "oldestTimestamp"
      getInvitations((invitations) => {
        socket.emit('invitationsFeed', {
          "append": false,
          "invitations": invitations
        });
      });
    }
  });

  socket.on('discoverGroups', (data) => {
    if(!loggedIn) {
      return;
    }

    if(data && "oldestTimestamp" in data) {
      if(!typeCheck('{ oldestTimestamp: Number }', data)) {
        return;
      }
      
      listPublicGroups(userID, (discoverGroupsResults) => {
        socket.emit('discoverGroupsResultsFeed', {
          "append": false,
          "discoverGroupsResults": discoverGroupsResults
        });
      }, data["oldestTimestamp"]);
    } else {
      listPublicGroups(userID, (discoverGroupsResults) => {
        socket.emit('discoverGroupsResultsFeed', {
          "append": true,
          "discoverGroupsResults": discoverGroupsResults
        });
      });
    }
  });

  socket.on('discoverGroupsSearch', (data) => {
    if(!loggedIn) {
      return;
    }
    
    if(!typeCheck('{ search: String } | { oldestTimestamp: Number, search: String }', data)) {
      return;
    }

    if("oldestTimestamp" in data) {
      searchPublicGroups(userID, data["search"], (data) => {
        socket.emit('discoverGroupsResultsFeed', {
          "append": false,
          "discoverGroupsResults": data
        });
      }, data["oldestTimestamp"]);
    } else {
      searchPublicGroups(userID, data["search"], (data) => {
        socket.emit('discoverGroupsResultsFeed', {
          "append": true,
          "discoverGroupsResults": data
        });
      });
    }
  });

  socket.on('discoverGroupsJoin', (data) => {
    if(!loggedIn) {
      return;
    }
    
    if(!typeCheck('{ chatID: Number }', data)) {
      return;
    }

    requestMember(userID, data["chatID"], (response) => {
      if(response == DISCOVER_BECAME_MEMBER) {
        socket.emit('discoverGroupsJoin', {
          "chatID": data["chatID"]
        });

        getGroupsFeedEntry(data["chatID"], (groups) => {
          socket.emit('groupsFeed', {
            "append": true,
            "groups": [groups]
          });
        });
      }
    });
  });

  socket.on('createGroupCheck', (data) => {
    if(!loggedIn) {
      return;
    }
    
    
    if(!typeCheck('{ name: ValidString }', data, options)) {
      return;
    }

    isGroupNameTaken(data["name"], (isTaken) => {
      socket.emit('createGroupCheck', {
        "isTaken": isTaken
      });
    });
  });

  socket.on('createGroup', (data) => {
    if(!loggedIn) {
      return;
    }
    
    
    if(!typeCheck('{ name: ValidString, isPublic: Boolean, requestToJoin: Boolean }', data, options)) {
      return;
    }

    createGroup(data["name"], userID, data["isPublic"], data["requestToJoin"], (newChatID) => {
      addIntoGroup(userID, newChatID, () => {
        socket.emit('createGroup');
      });
    });
  });

  socket.on('register', function(data) {  
    if(loggedIn) {
      socket.emit('register', {
        "message": "Already logged in"
      });
      return;
    }
    
    if(!typeCheck('{ username: ValidString, password: ValidString }', data, options)) {
      return;
    }

    userExists(data["username"], (id) => {
      if(id != 0) {
        socket.emit('register', {
          "message": "Username is taken"
        });
        return;
      }

      createUser(data["username"], data["password"], (id) => {
        loggedIn = true;
        nickname = data["username"];
        userID = id;

        socket.emit('register', {
          "nickname": nickname
        });
      });
    });
  });

  socket.on('chat', (data) => {
    if(!loggedIn) {
      return;
    }
    
    if(!typeCheck('{ chatID: Number }', data, options)) {
      return;
    }

    if(chatID == data["chatID"]) return;

    appendMessages = false;

    chatID = data["chatID"];
    if(data["chatID"] == 0) {
      if(currentRoom != null) {
        socket.leave(currentRoom);
        socket.emit('chat', {
          "leave": true
        });
      }
    } else {
      getGroupName(data["chatID"], (name) => {
        if(name != null) {
          if(currentRoom != null) socket.leave(currentRoom);
          currentRoom = "chat" + data["chatID"];
          socket.join(currentRoom);
          
          socket.emit('chat', {
            "chatID": data["chatID"],
            "name": name
          });
          
          console.log(`user ${nickname} joined ${name}`);
        }
      });
    }
  });

  socket.on('messages', (data) => {
    if(!loggedIn) {
      return;
    }
    
    if(!data) {
      printChatHistory(chatID, (results) => {
        socket.emit('messages', {
          "append": appendMessages,
          "messages": results
        });

        appendMessages = true;
      });
    } else {
      
      if(!typeCheck('{ start: Number, limit: Number }', data, options)) {
        return;
      }
      
      if(data["start"] < 0) return;
      if(data["limit"] < 1) return;

      printChatHistory(chatID, (results) => {
        socket.emit('messages', {
          "append": appendMessages,
          "messages": results
        });

        appendMessages = true;
      }, data["start"], data["limit"]);
    }

  });

  socket.on('message', (data) => {
      if(!loggedIn) {
        return;
      }
      
      if(!typeCheck('{ content_type: Number, content: ValidString }', data, options)) {
        return;
      }

      sendMessage(userID, chatID, data["content"], data["content_type"], (data) => {
        let name = "chat"+chatID;
        io.to(name).emit('messages', {
          "append": appendMessages,
          "messages": [data]
        });
        appendMessages = true;
      });
    });
});




// http server listening for requests on port 3789
http.listen(port, function(){
  console.log('listening on *:3789');
})
