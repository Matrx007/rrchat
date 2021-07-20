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
module.exports.discover = function(query, after, before, limit) {
    return new Promise((resolve) => {
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
                throw new ResponseError(
                    err,
                    500,
                    "Failed to fetch 'discover' page"
                );
            }

            resolve(results);
        });
    });
}

/**
    @param {String} username
    
    Returns userID of given username.
    If user doesn't exist 0 will be returned.
*/
module.exports.getUserID = function(username) {
    return new Promise((resolve) => {
        let sql = `
            SELECT id
            FROM users
            WHERE name=?;
        `;
        
        connection.query(sql, [username], (err, results) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to identify account"
                );
            }
            
            resolve(results[0] ? results[0]["id"] : 0);
        });
    });
}

/**
    @param {String} username
    
    Returns userID of given username.
    If user doesn't exist 0 will be returned.
*/
module.exports.userExists = function(userID) {
    return new Promise((resolve) => {
        let sql = `
            SELECT id
            FROM users
            WHERE id=?;
        `;
        
        connection.query(sql, [userID], (err, results) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to identify account"
                );
            }
            
            if(results[0] && results[0]["id"] > 0) {
                resolve(true);
            } else {
                throw new ResponseError(
                    null,
                    404,
                    "User doesn't exist"
                );
            }
        });
    });
}

/**
    @param {Number} userID
    
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
            
            if(results[0] && results[0]["id"] > 0) {
                resolve(true);
            } else {
                reject(new ResponseError(
                    null,
                    403,
                    "Incorrect password"
                ));
            }
        });
    });
}
