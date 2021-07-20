
const { ResponseError, handleResponseError, error } = require('./error_handling.js');
const { typeCheck, stringToInteger, stringToUInteger, initializeParameters, guard, respond } = require('./tools.js');
const { discover, getUserID, checkPassword, userIDExists, createUser } = require('./database_interface.js');
const { logInUser, logOutUser } = require('./redis_interface.js');
const { constants } = require('./constants.js');

// #####################################
// # REST API METHODS                  #
// #####################################


module.exports.bind = function(app) {

/*
    Responds to:
    POST /rrchat/api/login

        REQUEST:
        {
            "username": <USERNAME>,
            "password": <PASSWORD>
        }
        
        RESPONSE:
        {
            "token": <ACCESS TOKEN>, 
            "userID": <USER ID>
        }
*/
app.post(constants.prefix + '/api/login', async (req, res) => {
    
    let { username, password } = req.body;
    
    try {
        guard('StrLen', username, 'username');
        guard('StrLen', password, 'password');
        
        let userID = await getUserID(username);
        if(!userID) error(404, 'Invalid user ID');
        
        let passwordMatches = await checkPassword(userID, password);
        if(!passwordMatches) error(403, "Password doesn't match");
        
        let token = await logInUser(userID);
        
        respond(res, {
            token: token,
            userID: userID
        });
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    POST /rrchat/api/logout

        REQUEST:
        {
            "token": <ACCESS TOKEN>
        }
*/
app.post(constants.prefix + '/api/logout', async (req, res) => {
    
    let { token } = req.body;
    
    try {
        guard('StrLen', token, 'token');
        
        let result = await logOutUser(token);
        
        respond(res, {success: result});
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    POST /rrchat/api/register

        REQUEST:
        {
            "username": <USERNAME>,
            "password": <PASSWORD>
        }
        
        RESPONSE:
        {
            "token": <ACCESS TOKEN>, 
            "userID": <USER ID>
        }
*/
app.post(constants.prefix + '/api/register', async (req, res) => {
    
    let { username, password } = req.body;
    
    try {
        guard('StrLen', username, 'username');
        guard('StrLen', password, 'password');
        
        let userNameTaken = await getUserID(username);
        if(userNameTaken) error(409, 'Username already taken');
        
        let userID = await createUser(username, password);
        if(!userID) error(500, 'Failed to register');
        
        let token = await logInUser(userID);
        
        respond(res, {
            token: token,
            userID: userID
        });
    } catch(e) {
        handleResponseError(e, res);
    }
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
app.get(constants.prefix + '/api/discover', async (req, res) => {
    
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
        (msg) => { res.status(400).send({message: msg}); },
        // On parameter of invalid type:
        (msg) => { res.status(400).send({message: msg}); },
        // On parameter breaking rules:
        (msg) => { res.status(400).send({message: msg}); }
    );
    
    if(!parameters) {
        return;
    }
    
    // All conditions passed, run queries
    try {
        let data = await discover(parameters["query"], parameters["after"], parameters["before"], parameters["limit"]);
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json(data);
    } catch(e) {
        handleResponseError(e, res);
    }
});

}
