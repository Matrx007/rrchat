// database_interface.js
// #####################

const { ResponseError } = require('./error_handling.js');

const fs = require('fs');
const path = require('path');
const mysql  = require('mysql');

// ##############################
// # DATABASE AUTHENTICATION    #
// ##############################

let databasePasswordPath = path.resolve('../database_pass');
let databasePass = fs.readFileSync(databasePasswordPath, {encoding: 'utf8'});

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

module.exports.makeSQLLIKESafe = function(string) {
    return string.replace('_', "\\_").replace('%', "\\%");
}


// #####################################
// # DATA FUNCTIONS                    #
// #####################################

/**
    @param {String} username    Name of target user
    
    @returns {Boolean}          ID of found user
    
    Returns userID of given username.
    If user doesn't exist 0 will be returned.
*/
module.exports.getUserID = function(username) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT id
            FROM users
            WHERE name=?;
        `;
        
        connection.query(sql, [username], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to identify account"
                ));
            }
            
            resolve(results[0] ? results[0]["id"] : 0);
        });
    });
}

/**
    @param {Number} userID
    
    @returns {Boolean}  User exists
    
    Checks if user with give ID exists.
*/
module.exports.userIDExists = function(userID) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT id
            FROM users
            WHERE id=?;
        `;
        
        connection.query(sql, [userID], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to identify account"
                ));
            }
            
            console.log("user exists results: ", results);
            
            resolve(results[0] && results[0]["id"] > 0);
        });
    });
}

/**
    @param {Number} userID
    
    @returns {Boolean}  User exists && password matches
    
    Returns true if user exists and password matches. Otherwise false.
*/
module.exports.checkPassword = function(userID, password) {
    return new Promise((resolve, reject) => {        
        let sql = `
            SELECT id 
            FROM users
            WHERE id=? AND pass=AES_ENCRYPT(name, ?);
        `;
        
        connection.query(sql, [userID, password], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to check password"
                ));
            }
            
            resolve(results[0] && results[0]["id"] > 0);
        });
    });
}

/**
    @param {String} username    Name of new user
    @param {String} password    Password of new user
    
    @returns {Boolean}  Success
    
    Creates a new user with given username and password.
    Returns true if user was created successfully, false otherwise.
*/
module.exports.createUser = function(username, password) {
    return new Promise((resolve, reject) => {     
        let sql = `
            INSERT INTO users (name, pass) 
            VALUES(?, AES_ENCRYPT(?, ?))
        `;
        
        connection.query(sql, [username, username, password], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to check password"
                ));
            }
            
            if(results.insertId) {
                resolve(true);
            } else {
                reject(new ResponseError(
                    null,
                    500,
                    "Failed to register"
                ));
                resolve(false);
            }
        });
    });
}


// #####################################
// # DATA QUERIES                      #
// #####################################

/**
    @param  {String} query          String to search chats by
    @param  {Number} after          Only select chats after certain created timestamp
    @param  {Number} before         Only select chats before certain created timestamp
    @param  {Number} limit          Only select this number of chats
    
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
module.exports.discover = function(query, after, before, limit) {
    return new Promise((resolve, reject) => {
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
        query = module.exports.makeSQLLIKESafe(query);

        // Execute the SQL query
        connection.query(sql, ["%"+query+"%", after, before, limit], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to fetch 'discover' page"
                ));
            }

            resolve(results);
        });
    });
}

/**
    @param  {Number} userID         UserID of target user
    @param  {Number} after          Only select chats after certain created timestamp
    @param  {Number} before         Only select chats before certain created timestamp
    @param  {Number} limit          Only select this number of chats
    
    Lists user's recently viewed chats.
    - Allows dynamic loading, using the 'after', 'before' and 'limit' parameters
    - Sorted by latest message
    
    Passed to callback: 
    [
        {
            chat: Number,
            name: String,
            message: String,
            timestamp: Number
        }, ..
    ]
*/
module.exports.userChats = function(userID, after, before, limit) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT members.chat, info.name, UNIX_TIMESTAMP(IFNULL(latest.timestamp, info.created)) AS timestamp, latest.content
            FROM members
            LEFT JOIN (
                SELECT messages.chat, MAX(messages.timestamp) AS timestamp, messages.content
                FROM messages
                GROUP BY messages.chat
                ORDER BY messages.timestamp
                DESC
            ) AS latest
            ON latest.chat=members.chat
            LEFT JOIN (
                SELECT id, name, created
                FROM chats
            ) AS info
            ON info.id=members.chat
            WHERE members.user = ? 
            HAVING
                timestamp > ? AND 
                timestamp < ? 
            ORDER BY timestamp
            DESC
            LIMIT ?
        `;
        
        // Execute the SQL query
        connection.query(sql, [userID, after, before, limit], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to fetch latest activity"
                ));
            }

            resolve(results);
        });
    });
}

/**
    @param  {Number} userID         UserID of target user
    @param  {Number} after          Only select chats after certain created timestamp
    @param  {Number} before         Only select chats before certain created timestamp
    @param  {Number} limit          Only select this number of chats
    
    Lists invitations sent to user.
    - Allows dynamic loading, using the 'after', 'before' and 'limit' parameters
    - Sorted by latest
    
    Passed to callback: 
    [
        {
            id: Number,
            inviter: String,
            inviterID: Number,
            chat: String,
            chatID: Number,
            timestamp: Number
        }, ..
    ]
*/
module.exports.userInvitations = function(userID, after, before, limit) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT invitations.id, nameJoin.name AS inviter, invitations.inviter AS inviterID, chatJoin.name AS chat, invitations.chat AS chatID, UNIX_TIMESTAMP(invitations.timestamp) AS timestamp
            FROM invitations 
            LEFT JOIN (
                SELECT id, name
                FROM users
            ) AS nameJoin
            ON nameJoin.id=invitations.inviter
            LEFT JOIN (
                SELECT id, name
                FROM chats
            ) AS chatJoin
            ON chatJoin.id=invitations.chat
            WHERE 
                invitations.invitee=? AND 
                invitations.hidden=0
            HAVING
                timestamp>? AND
                timestamp<?
            ORDER BY timestamp
            DESC
        `;
        
        // Execute the SQL query
        connection.query(sql, [userID, after, before, limit], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to fetch invitations"
                ));
            }

            resolve(results);
        });
    });
}

/**
    @param  {Number} userID         UserID of target user
    @param  {Number} after          Only select chats after certain created timestamp
    @param  {Number} before         Only select chats before certain created timestamp
    @param  {Number} limit          Only select this number of chats
    
    Lists requests sent to user's chats.
    - Allows dynamic loading, using the 'after', 'before' and 'limit' parameters
    - Sorted by latest
    
    Passed to callback: 
    [
        {
            id: Number,
            requester: String,
            requesterID: Number,
            chat: String,
            chatID: Number,
            timestamp: Number
        }, ..
    ]
*/
module.exports.userRequests = function(userID, after, before, limit) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT requestsJoin.id, usersJoin.name AS requester, requestsJoin.user AS requesterID, chats.name AS chat, chats.id AS chatID, UNIX_TIMESTAMP(requestsJoin.timestamp) AS timestamp
            FROM chats
            RIGHT JOIN (
                SELECT id, user, chat, requested AS timestamp, hidden
                FROM requests
                WHERE hidden=0
            ) AS requestsJoin
            ON requestsJoin.chat=chats.id
            LEFT JOIN (
                SELECT id, name
                FROM users
            ) AS usersJoin
            ON usersJoin.id=requestsJoin.user
            WHERE admin=?
            HAVING
                timestamp>? AND
                timestamp<?
            ORDER BY timestamp
            DESC
            LIMIT ?`;
        
        // Execute the SQL query
        connection.query(sql, [userID, after, before, limit], (err, results) => {
            if(err) {
                reject(new ResponseError(
                    err,
                    500,
                    "Failed to fetch requests"
                ));
            }

            resolve(results);
        });
    });
}
