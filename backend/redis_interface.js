
const { ResponseError } = require('./error_handling.js');

const redis = require("redis");
const crypto = require("crypto");

// ##############################
// # SOCKETS                    #
// ##############################

const client = redis.createClient();

client.on("error", function(error) {
  console.error(error);
});


// #####################################
// # REDIS FUNCTIONS                   #
// #####################################


/**
    @return {String}    New access token.
    
    Generates a new access token
*/
module.exports.generateAccessToken = function() {
    return new Promise((resolve) => {
        crypto.randomBytes(-1, (err, buffer) => {
            if(err) {
                throw new Error({
                    err: err,
                    responseCode: 500,
                    msg: "Failed to generate access token"
                });
            }
            
            resolve(buffer.toString('hex'));
        });
    });
}

/**
    @param {Number} userID      UserID of the user to which given access token will be assigned to.
    @param {String} token       Access token which will be assiged to given user.
                                This token is usually generated using generateAccessToken().
    
    Assigns given access token to given user. 
    Access tokens are stored in local Redis server.
*/
module.exports.storeAccessToken = function(token, userID) {
    return new Promise((resolve) => {
        client.set('token_'+token, userID, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to store access token"
                );
            }
            
            resolve(result);
        });
    });
}

module.exports.doesAccessTokenHaveUserID = function(token) {
    return new Promise((resolve) => {
        client.get('token_'+token, (err, result) => {
            if(err) {
                throw new Error({
                    err: err,
                    responseCode: 500,
                    msg: "Failed to validate access token"
                });
            }
            
            resolve(result != null);
        });
    });
}

module.exports.doesUserIDHaveAccessToken = function(userID) {
    return new Promise((resolve) => {
        client.get('user_'+userID, (err, result) => {
            if(err) {
                throw new Error({
                    err: err,
                    responseCode: 500,
                    msg: "Failed to validate access token"
                });
            }
            
            resolve(result != null);
        });
    });
}

/**
    @param {String} token   Access token of user
                            This token is must be already stored using storeAccessToken(..)
    
    Gets userID of given access token.
    Access tokens are stored in local Redis server.
*/
module.exports.getUserIDOfAccessToken = function(token) {
    return new Promise((resolve) => {
        client.get('token_'+token, (err, result) => {
            if(err) {
                throw new Error({
                    err: err,
                    responseCode: 500,
                    msg: "Failed to store access token"
                });
            }
            
            let userID = module.exports.stringToUInteger(result);
            if(userID) resolve(userID);
            else {
                throw new ResponseError(
                    "Access token's value is of invalid type",
                    500,
                    "Failed to validate access token"
                );
            }
        });
    });
}

/**
    @param {Number} userID  Access token which will be assiged to given user
                            This token is must be already stored using storeAccessToken(..)
    
    Gets access token assigned to given user. 
    Access tokens are stored in local Redis server.
*/
module.exports.getAccessTokenOfUserID = function(userID) {
    return new Promise((resolve) => {        
        client.get('user_'+userID, (err, token) => {
            if(err) {
                throw new Error({
                    err: err,
                    responseCode: 500,
                    msg: "Failed to store access token"
                });
            }
            
            if(token) resolve(token);
            else {
                throw new ResponseError(
                    "Access token's value is of invalid type",
                    500,
                    "Failed to check access token"
                );
            } 
        });
    });
}
