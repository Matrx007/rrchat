
const { ResponseError } = require('./error_handling.js');
const { stringToUInteger } = require('./tools.js');

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
        crypto.randomBytes(32, (err, buffer) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
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
        client.mset('token_'+token, userID, 'user_'+userID, token, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
            }
            
            resolve(result);
        });
    });
}

/**
    @param {Number} userID      UserID of the user whose access token will be destroyed.
    @param {String} token       Access token which will be destroyed.
    
    Deletes userID and access token of given user.
*/
module.exports.destroyAccessToken = function(token, userID) {
    return new Promise((resolve) => {
        client.del('token_'+token, 'user_'+userID, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
            }
            
            resolve(result);
        });
    });
}

/**
    @param {String} token   Access token of user
    
    @returns {Boolean}      Is access token valid
    
    Check if given token belongs to any users.
*/
module.exports.doesAccessTokenHaveUserID = function(token) {
    return new Promise((resolve) => {
        client.get('token_'+token, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
            }
            
            resolve(!!result);
        });
    });
}


/**
    @param {String} userID  ID of user
    
    @returns {Boolean}      Does user have access token
    
    Check if given user has an access token assigned to it.
*/
module.exports.doesUserIDHaveAccessToken = function(userID) {
    return new Promise((resolve) => {
        client.get('user_'+userID, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
            }
            
            resolve(!!result);
        });
    });
}

/**
    @param {String} token   Access token of user
                            This token must be already stored using storeAccessToken(..)
    
    @returns {Number}       Returns ID of the owner of given token
    
    Gets userID of given access token.
    Access tokens are stored in local Redis server.
*/
module.exports.getUserIDOfAccessToken = function(token) {
    return new Promise((resolve) => {
        client.get('token_'+token, (err, result) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to store access token"
                );
            }
            
            resolve(stringToUInteger(result));
            
            /*let userID = stringToUInteger(result);
            if(userID) resolve(userID);
            else {
                throw new ResponseError(
                    "Access token's value is of invalid type",
                    500,
                    "Failed to validate access token"
                );
            }*/
        });
    });
}

/**
    @param {Number} userID  Access token which will be assiged to given user
                            This token is must be already stored using storeAccessToken(..)
    
    @returns {String}       Returns access token belonging to given user
    
    Gets access token assigned to given user. 
    Access tokens are stored in local Redis server.
*/
module.exports.getAccessTokenOfUserID = function(userID) {
    return new Promise((resolve) => {        
        client.get('user_'+userID, (err, token) => {
            if(err) {
                throw new ResponseError(
                    err,
                    500,
                    "Failed to validate access token"
                );
            }
            
            resolve(token);
            
            /*if(token) resolve(token);
            else {
                throw new ResponseError(
                    "Access token's value is of invalid type",
                    500,
                    "Failed to check access token"
                );
            }*/
        });
    });
}

/**
    @param {Number} userID  ID of target user. This ID must be valid.
    
    @returns {String}       Returns access token belonging to or generated for given user
    
    Access token belonging to given user will be fetched or
    a new access token will be assigned to given user.
*/
module.exports.logInUser = async function(userID) {
    let token = await module.exports.getAccessTokenOfUserID(userID);
    
    if(token) {
        return token;
    }

    let newToken = await module.exports.generateAccessToken();
    await module.exports.storeAccessToken(newToken, userID);
    
    return newToken;
}

/**
    @param {Number} userID  ID of target user. This ID must be valid.
    
    Access token belonging to this user will be destroyed.
*/
module.exports.logOutUser = async function(token) {
    let userID = await module.exports.getUserIDOfAccessToken(token);
    let result = await module.exports.destroyAccessToken(token, userID);
    
    return result;
}

/**
    @param {String}     Access token of target user
    
    @returns {Number}   Returns ID of the owner of this access token
*/
module.exports.authenticateUser = async function(token) {
    let userID = await module.exports.getUserIDOfAccessToken(token);
    
    return userID;
}
