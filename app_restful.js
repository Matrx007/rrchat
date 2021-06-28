/* eslint-disable */
// server.js
// express initializes variable app to be a function handler that you can supply an HTTP server

// ##############################
// # CONSTANTS                  #
// ##############################

const prefix = '/rrchat/dev';

const typeCheckOptions = {
    customTypes: {
        StrNum: {
            typeOf: 'String',
            validate: (str) => {
                return !isNaN(str);
            }
        }
    }
};

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
// # NODE MODULES               #
// ##############################

const typeCheck = require("type-check").typeCheck;

const crypto = require("crypto");
const { promisify } = require('util');
const randomBytesAsync = promisify(require('crypto').randomBytes);

const express = require('express');
const redis = require("redis");
const mysql  = require('mysql');

const fs = require('fs');
const path = require('path');

// ##############################
// # DATABASE AUTHENTICATION    #
// ##############################

let databasePasswordPath = path.resolve('../database_pass');
let databasePass = fs.readFileSync(databasePasswordPath, {encoding: 'utf8'});

// ##############################
// # SOCKETS                    #
// ##############################

// Express.js

let app = express();
let http = require('http').Server(app);
let port = process.env.PORT || 3789; //production: 3802

app.use(express.json());

app.get(prefix, function(req, res) {
	res.sendFile(__dirname + '/views/restful.html')
})

app.use(prefix + '/public', express.static('./public'));

// Socket.io

let io = require('socket.io')(http, { path: '/rrchat/socket.io', origins: '*:*' });

// MySQL

let connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: databasePass,
    database: 'chat'
});

// Redis

const client = redis.createClient();

client.on("error", function(error) {
  console.error(error);
});

// #####################################
// # REDIS FUNCTIONS                   #
// #####################################

/**
    callbacks:
    @param {Function} callback(token)   Called after a successful execution. 
                                        64 characters long token will be passed into the callback.
    @param {Function} onErr             Called after a failed execution.
    
    Result of this function is usually passed into storeAccessToken(..).
*/
function generateAccessToken(callback, onErr = null) {
    crypto.randomBytes(32, function(err, buffer) {
        if(err) {
            onErr && onErr();
            return;
        }
        
        callback(buffer.toString('hex'));
    });
}

/**
    data:
    @param {String} username    Username to which given access token will be assigned to.
    @param {String} token       Access token which will be assiged to given user.
                                This token is usually generated using generateAccessToken().
    callbacks:
    @param {Function} callback(result)  Will be called after a successful query.

    Assigns given access token to given user. 
    Access tokens are stored in local Redis server.
*/
function storeAccessToken(token, userID, callback, onErr = null) {
    client.set(token, userID, (err, result) => {
        if(err) {
            onErr && onErr();
            return;
        }
        
        callback(result);
    });
}

/**
    data:
    @param {String} token   Access token which will be assiged to given user
                            This token is must be already stored using storeAccessToken(..)
    callbacks:
    @param {Function} callback(result)  Will be called after a successful query
    
    Assigns given access token to given user. 
    Access tokens are stored in local Redis server.
    
    Callback's parameter 'result' is the userID corresponding to this access token.
*/
function checkAccessToken(token, callback, onErr = null) {
    client.get(token, (err, result) => {
        if(err) onErr && onErr();
        else    callback(result);
    });
}

// #####################################
// # DATABASE ACCESS                   #
// #####################################

connection.connect(function(err) {
    if (err) {
        return console.error('error: ' + err.message);
        process.exit(1);
    }

    console.log('Connected to the MySQL server.');
});

function makeSQLLIKESafe(string) {
    return string.replace('_', "\\_").replace('%', "\\%");
}

// #####################################
// # DATABASE FUNCTIONS                #
// #####################################

/**
    @param  {String} query          String to search chats by
    @param  {Number} after          Only select chats after certain created timestamp
    @param  {Number} before         Only select chats before certain created timestamp
    @param  {Number} limit          Only select this number of chats
    @param  {Function} callback     Called after a successful SQL query
    @param  {Function} onError(msg) Called after a failed SQL query
    
    Lists newest chats.
    - Allows searching using the 'query' parameter
    - Allows dynamic loading, using the 'after', 'before' and 'limit' parameters
    - Sorted by chat's 'created' timestamp, newest first
    
    Passed to callback: 
    [
        {
            id: Number,
            name: String,
            public: Number (1 or 0)
            requestToJoin: Number (1 or 0),
            created: Number
        }, ..
    ]
*/
function discover(query, after, before, limit, callback, onError = null) {
    let sql = `
        SELECT chats.id, chats.name, second.members, chats.public, chats.requestToJoin, UNIX_TIMESTAMP(chats.created) AS created
        FROM chats 
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
        WHERE chats.public=TRUE AND name LIKE ? AND UNIX_TIMESTAMP(chats.created) > ? AND UNIX_TIMESTAMP(chats.created) < ? ORDER BY chats.created DESC LIMIT ?;
        `;

    // Escape underscores and question marks
    query = makeSQLLIKESafe(query);

    // Execute the SQL query
    connection.query(sql, ["%"+query+"%", after, before, limit], (err, results) => {
        if(err) {
            console.log("#############################");
            console.log("Failed query: ", this.sql);
            console.log("Error message: ", err);
            if(onError) onError("Query failed");
            return;
        }

        callback(results);
    });
}

/**
    @param  {Number} chatID         ID of the chat
    @param  {Function} callback     Called after a successful SQL query
    @param  {Function} onError(msg) Called after a failed SQL query
    
    Checks if given chat is public or not.
    
    Passed to callback: 
    true or false
*/
function isChatPublic(chatID, callback, onError = null) {
    let sql = `SELECT public FROM chats WHERE id=?;`;

    // Execute the SQL query
    connection.query(sql, [chatID], (err, results) => {
        if(err) {
            console.log("#############################");
            console.log("Failed query: ", this.sql);
            console.log("Error message: ", err);
            onError && onError("Query failed");
            return;
        }
        
        if(results?.length == 0) {
            onError && onError("No group with this id");
        }
        
        callback(results[0]["public"] == 1);
    });
}

/**
    @param  {Number} chatID         ID of the chat
    @param  {Function} callback     Called after a successful SQL query
    @param  {Function} onError(msg) Called after a failed SQL query
    
    Lists members of given chat.
    
    Passed to callback: 
    {
        "admin": <ADMIN NAME>,
        "adminID": <ADMIN ID>,
        "members": [
            {
                "id": <USER ID>,
                "name": <USER NAME>
            },
            ..
        ]
    }
*/
function members(chatID, after, before, limit, callback, onError = null) {
    let sql = `
        SELECT user, name.name, UNIX_TIMESTAMP(joined) AS joined
        FROM members
        LEFT JOIN (
            SELECT name, id
            FROM users
        ) AS name
        ON name.id=members.user
        WHERE chat=? 
            AND UNIX_TIMESTAMP(joined) > ?
            AND UNIX_TIMESTAMP(joined) < ? 
        ORDER BY joined ASC 
        LIMIT ?;
    `;

    // Execute the SQL query
    connection.query(sql, [chatID, after, before, limit], (err1, members) => {
        if(err1) {
            console.log("#############################");
            console.log("Failed query: ", this.sql);
            console.log("Error message: ", err1);
            onError && onError("Query failed");
            return;
        }
        
        sql = `
            SELECT admin, name.name
            FROM chats
            LEFT JOIN (
                SELECT name, id
                FROM users
            ) AS name
            ON name.id=chats.admin
            WHERE chats.id=?;
        `;
        connection.query(sql, [chatID], (err2, admin) => {
            if(err2) {
                console.log("#############################");
                console.log("Failed query: ", this.sql);
                console.log("Error message: ", err2);
                onError && onError("Query failed");
                return;
            }
            
            callback({
                admin: admin["name"],
                adminID: admin["admin"],
                members: members
            });
        });
    });
}

/**
    @param {String} username            Username of user whose userID is needed.
    @param {Function} callback(userID)  Called after a successful query.
    
    Mostly used at login.
    Can be used to check if user exists.
*/
function getUserID(username, callback) {
    let sql = `
        SELECT id
        FROM users
        WHERE name=?;
    `;
    
    connection.query(sql, [username], (err, results) => {
        if(err) {
            console.log("#############################");
            console.log("Failed query: ", this.sql);
            console.log("Error message: ", err);
            onError && onError("Query failed");
            return;
        }
        
        callback(results[0] && results[0]["id"]);
    });
}

/**
    @param {String} username                ID of user whose password needs to be checked.
    @param {String} password                Password which needs to be checked.
    @param {Function} callback(matches)     Called after a successful query.
    
    Used to check if given password belongs to given user.
*/
function checkPassword(userID, password, callback) {
    let sql = `
        SELECT id
        FROM users
        WHERE id=? AND pass=AES_ENCRYPT(name, ?);
    `;
    
    connection.query(sql, [userID, password], (err, results) => {
        if(err) {
            console.log("#############################");
            console.log("Failed query: ", this.sql);
            console.log("Error message: ", err);
            onError && onError("Query failed");
            return;
        }
        
        callback(results[0] && results[0]["id"] > 0);
    });
}

// #####################################
// # UTILITY FUNCTIONS                 #
// #####################################

/**
    @param {String} string  String containing an positiv or negative integer
    @returns {Number}       String converted to positive or negative <integer> or <undefined> if not possible
*/
function stringToInteger(string) {
    if (typeof string === 'string')
        return /^-?\d+$/.test(string) ? parseInt(string, 10) : undefined;
}

/**
    @param {String} string  String containing an positiv integer
    @returns {Number}       String converted to positive <integer> or <undefined> if not possible
*/
function stringToUInteger(string) {
    if (typeof string === 'string')
        return /^\d+$/.test(string) ? parseInt(string, 10) : undefined;
}

/**    
    data:
    @param  {Object} template   Table containing type and default values to all possible parameters
    @param  {Object} data       Input data which will be initialized
    callbacks:
    @param  {Function} ifUnknownParameter       Called if unknown parameter is given
    @param  {Function} ifParameterInvalidType   Called if parameter of invalid type is given
    @param  {Function} ifParameterBreaksRules   Called if parameter breaks rules set in template 
                                                (above maximum, below minimum etc)
    
    @return {Object}    Returns object containing initialized parameters 
                        or null if any given parameter isn't mentioned in
                        the template
    
    This function is used to easily initialize uninitialized URL parameters stored as strings.
    
    Syntax of template:
    {
        parameter: { type: 'Number' or 'String', default: number or string, ?max: number, ?min: number },
        ..
    }
    
    Example template:
    {
        before:     { type: 'StrNum', default: 4294967295,  min: 0, max: 4294967295},
        after:      { type: 'StrNum', default: 0,           min: 0, max: 4294967295},
        query:      { type: 'String', default: ''},
        limit:      { type: 'StrNum', default: 30,          min: 1, max: 30}
    }
*/
function initializeParameters(template, data, ifUnknownParameter, ifParameterInvalidType, ifParameterBreaksRules) {
    /*
        template:
        {
            "parameter1": { type: 'Number', default: 238479 },
            "parameter2": { type: 'String', default: 'none' }
        }
    */
    
    let results = {};
    
    for(let key in template) {
        results[key] = template[key]["default"];
        
        if(template[key]["type"] == 'StrNum') {
            if(template[key].hasOwnProperty("max")) {
                if(template[key]["default"] > template[key]["max"]) {
                    console.log(`Problem in template at '${key}': default > max`);
                    process.exit(1);
                    continue;
                }
            }
            
            if(template[key].hasOwnProperty("min")) {
                if(template[key]["default"] < template[key]["min"]) {
                    console.log(`Problem in template at '${key}': default < min`);
                    process.exit(1);
                    continue;
                }
            }
        }
    }
    
    for(let key in data) {
        if(template.hasOwnProperty(key)) {
            
            // Make sure parameter in template contains 'type' and 'default' key
            if(!template[key].hasOwnProperty("type")) {
                console.log(`Problem in template at '${key}': missing 'type' property`);
                process.exit(1);
                continue;
            }
            if(!template[key].hasOwnProperty("default")) {
                console.log(`Problem in template at '${key}': missing 'default' property`);
                process.exit(1);
                continue;
            }
            
            // Check if correct type
            if(!typeCheck(template[key]["type"], data[key], typeCheckOptions)) {
                ifParameterInvalidType(`Parameter '${key}' is of invalid type`);
                return null;
            }
            
            // Number type
            if(template[key]["type"] == 'StrNum') {
                
                // Initialize if uninitialized
                results[key] = data[key] ? stringToInteger(data[key]) : template[key]["default"];
                
                if(template[key].hasOwnProperty("max")) {
                    if(results[key] > template[key]["max"]) {
                        ifParameterBreaksRules(`Parameter '${key}' above its maximum (${template[key]["max"]})`);
                        return null;
                    }
                }
                
                if(template[key].hasOwnProperty("min")) {
                    if(results[key] < template[key]["min"]) {
                        ifParameterBreaksRules(`Parameter '${key}' below its minimum (${template[key]["min"]})`);
                        return null;
                    }
                }
            }
            
            // String type
            if(template[key]["type"] == 'String') {
                // String can't have 'max' or 'min' property
                if(template[key].hasOwnProperty("max")) {
                    console.log(`Problem in template at '${key}': String can't have 'max' property`);
                    process.exit(1);
                    continue;
                }
                if(template[key].hasOwnProperty("min")) {
                    console.log(`Problem in template at '${key}': String can't have 'min' property`);
                    process.exit(1);
                    continue;
                }
                
                // Initialize if uninitialized
                results[key] = data[key] || template[key]["default"];
            }
        } else {
            ifUnknownParameter(`Unknown parameter: '${key}'`);
            return null;
        }
    }
    
    return results;
}

// #####################################
// # REST API METHODS                  #
// #####################################

app.post(prefix + '/api/login', (req, res) => {
    
    console.log(req.body);
    
    let username = req.body["username"];
    let password = req.body["password"];
    
    if(!(typeof username === 'string' || username instanceof String)) {
        res.status(400).send({message: "'username' is not a string"});
        return;
    }
    
    if(username.length == 0) {
        res.status(400).send({message: "'username' is empty"});
    }
    
    if(!(typeof password === 'string' || password instanceof String)) {
        res.status(400).send({message: "'password' is not a string"});
        return;
    }
    
    if(password.length == 0) {
        res.status(400).send({message: "'password' is empty"});
    }
    
    // Check if user exists
    getUserID(username, (userID) => {
        if(!userID) {
            res.status(404).send({message: "User with this username doesn't exist"});
            return;
        }
        
        // User exists, now check if paassword matches
        checkPassword(userID, password, (matches) => {
            if(!matches) {
                res.status(403).send({message: "Incorrect password"});
                return;
            }
            
            // Password matches, now check generate & store a new access token
            generateAccessToken(
                // callback(token):
                (token) => {
                    storeAccessToken(
                        
                        // Data
                        token, 
                        userID, 
                        
                        // Access token stored
                        () => {
                            res.setHeader("Content-Type", "application/json");
                            res.status(200);
                            res.json({token: token, userID: userID});
                        },
                        
                        // on error
                        () => {
                            res.status(500).send({message: "Failed to store the access token"});
                        }
                    );
                },
                
                // on error:
                () => {
                    res.status(500).send({message: "Failed to generate an access token"});
                }
            );
        });
    });
});

/*
    Responds to:
    GET /rrchat/api/discover?q=<QUERY>?after=<AFTER TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>
    
    Response:
    [
        {
            "id": <CHAT ID>,
            "name": <CHAT NAME>,
            "members": <CHAT MEMBER COUNT>,
            "public": <IS CHAT PUBLIC>,
            "requestToJoin": <IS CHAT REQUEST-TO-JOIN>,
            "created": <CHAT CREATED TIMESTAMP>
        },
        ..
    ]
*/
app.get(prefix + '/api/discover', (req, res) => {
    
    // Set missing paramaters to their defaults
    let parameters = initializeParameters(
        // Template:
        {
            before:     { type: 'StrNum', default: 4294967295,  min: 0, max: 4294967295},
            after:      { type: 'StrNum', default: 0,           min: 0, max: 4294967295},
            query:      { type: 'String', default: ''},
            limit:      { type: 'StrNum', default: 30,          min: 1, max: 30}
        },         
        // Input data:
        req.query,
        // On unknown parameter:
        (msg) => {res.status(400).send({message: msg});},
        // On parameter of invalid type:
        (msg) => {res.status(400).send({message: msg});},
        // On parameter breaking rules:
        (msg) => {res.status(400).send({message: msg});}
    );
    
    if(!parameters) {
        return;
    }
    
    // All conditions passed, run queries
    discover(parameters["query"], parameters["after"], parameters["before"], parameters["limit"], (data) => {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json(data);
        
        console.log("sent: ", data);
    });
});

/*
    Responds to:
    GET /rrchat/api/chat/:id/members?after=<TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>
    
    Response:
    {
        "admin": <ADMIN NAME>,
        "adminID": <ADMIN ID>,
        "members": [
            {
                "id": <USER ID>,
                "name": <USER NAME>
            },
            ..
        ]
    }
*/
app.get(prefix + '/api/chat/:id/members', (req, res) => {
    
    // Set missing paramaters to their defaults
    let parameters = initializeParameters(
        // Template:
        {
            before:     { type: 'StrNum', default: 4294967295,  min: 0, max: 4294967295},
            after:      { type: 'StrNum', default: 0,           min: 0, max: 4294967295},
            limit:      { type: 'StrNum', default: 30,          min: 1, max: 30}
        },         
        // Input data:
        req.query,
        // On unknown parameter:
        (msg) => {res.status(400).send({message: msg});},
        // On parameter of invalid type:
        (msg) => {res.status(400).send({message: msg});},
        // On parameter breaking rules:
        (msg) => {res.status(400).send({message: msg});}
    );
    
    if(!parameters) {
        return;
    }
    
    let chatID = stringToInteger(req.params["id"]);
    if(chatID == undefined) {
        res.status(401).send({message: "Expected URL: /api/chat/<CHAT ID>/members"});
        return;
    }    
    
    // All conditions passed, run queries
    isChatPublic(chatID, (isPublic) => {
        if(isPublic) {
            members(chatID, parameters["after"], parameters["before"], parameters["limit"], (data) => {
                res.setHeader("Content-Type", "application/json");
                res.status(200);
                res.json(data);
                
                console.log("sent: ", data);
            });
        } else {
            res.status(401).send({message: "This chat is private"});
        }
    });
});


// #####################################
// # START LISTENERS                   #
// #####################################

// http server listening for requests on port 3789
http.listen(port, function(){
    console.log('listening on *:3789');
})

/* 

Temporarily saved:


    
    // Check parameter types
    if(!typeCheck(`{
                before:     Maybe StrNum | Undefined
                after:      Maybe StrNum | Undefined
                query:      Maybe String | Undefined
                limit:      Maybe StrNum | Undefined
                }`, req.query, typeCheckOptions)) {
        return res.status(400).send({
            message: 'Parameters are of invalid type'
        });
    }

*/