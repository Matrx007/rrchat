
const { ResponseError, handleResponseError } = require('./error_handling.js');
const { typeCheck, stringToInteger, stringToUInteger, initializeParameters } = require('./tools.js');
const { getUserID, checkPassword, discover } = require('./database_interface.js');
const { getAccessTokenOfUserID } = require('./redis_interface.js');
const { constants } = require('./constants.js');

// #####################################
// # REST API METHODS                  #
// #####################################


module.exports.bind = function(app) {
    
app.post(constants.prefix + '/api/login', async (req, res) => {
    
    let { username, password } = req.body;
    
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
    
    try {
        let userID = await getUserID(username);
        
        let passwordMatches = await checkPassword(userID, password);
        
        let token = await getAccessTokenOfUserID(userID);
        
        
    } catch(e) {
        handleResponseError(e, res);
        return;
    }
    
    res.status(500).send({message: "Unknown error"});
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
