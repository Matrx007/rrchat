
const { ResponseError, 
        handleResponseError, 
        error } = require('./error_handling.js');
const { typeCheck, 
        stringToInteger, 
        stringToUInteger, 
        initializeParameters, 
        guard, 
        respond } = require('./tools.js');
const { discover,
        getUserID,
        checkPassword,
        userIDExists,
        createUser,
        userChats,
        userInvitations,
        userRequests,
        isChatPublic,
        isMember,
        chatMembers,
        chatAdmin,
        chatInfo,
        chatIDExists,
        requestExists,
        invitationExists,
        joinChat,
        deleteInvitation,
        createRequest,
        leaveChat,
        getChatID,
        createChat,
        createInvitation } = require('./database_interface.js');
const { logInUser, 
        logOutUser, 
        getUserIDOfAccessToken } = require('./redis_interface.js');
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
        guard('StrTkn', token, 'token');
        
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
    
    try {
        
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
    
        let data = await discover(parameters["query"], parameters["after"], parameters["before"], parameters["limit"]);
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({chats: data});
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    GET /rrchat/api/me/chats?after=<TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>

        REQUEST:
        {
            "token": <ACCESS TOKEN>
        }
        
        RESPONSE:
        {
            "chats": [
                {
                    "id": <CHAT ID>,
                    "name": <CHAT NAME>,
                    "admin": <CHAT ADMIN>,
                    "public": <IS PUBLIC>,
                    "requestToJoin": <IS REQUEST TO JOIN>,
                    "created": <CREATED TIMESTAMP>
                },
                ..
            ]
        }
*/
app.get(constants.prefix + '/api/me/chats', async (req, res) => {
    
    try {
        let { token } = req.body;
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
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
        let data = await userChats(
            userID, 
            parameters["after"], 
            parameters["before"], 
            parameters["limit"]
        );
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({chats: data});
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    GET /rrchat/api/me/invitations?after=<TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>

        REQUEST:
        {
            "token": <ACCESS TOKEN>
        }
        
        RESPONSE:
        {
            "chats": [
                {
                    "id": <INVITATION ID>,
                    "inviter": <INVITER NAME>,
                    "inviterID": <INVITER ID>,
                    "chat": <CHAT NAME>,
                    "chatID": <CHAT ID>,
                    "timestamp": <INVITATION TIMESTAMP>
                },
                ..
            ]
        }
*/
app.get(constants.prefix + '/api/me/invitations', async (req, res) => {
    
    try {
        let { token } = req.body;
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
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
        let data = await userInvitations(
            userID, 
            parameters["after"], 
            parameters["before"], 
            parameters["limit"]
        );
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({invitations: data});
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    GET /rrchat/api/me/requests?after=<TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>

        REQUEST:
        {
            "token": <ACCESS TOKEN>
        }
        
        RESPONSE:
        {
            "chats": [
                {
                    "id": <REQUEST ID>,
                    "requester": <REQUEST NAME>,
                    "requesterID": <REQUEST ID>,
                    "chat": <CHAT NAME>,
                    "chatID": <CHAT ID>,
                    "timestamp": <REQUEST TIMESTAMP>
                },
                ..
            ]
        }
*/
app.get(constants.prefix + '/api/me/requests', async (req, res) => {
    
    try {
        let { token } = req.body;
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
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
        let data = await userRequests(
            userID, 
            parameters["after"], 
            parameters["before"], 
            parameters["limit"]
        );
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({requests: data});
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    GET /rrchat/api/chat/:id/members?after=<TIMESTAMP>?before=<BEFORE TIMESTAMP>?limit=<COUNT>

        Conditions:
        if(chatIsPublic) {
            <SUCCESS>
        } else {
            if(belongsToGroup) {
                <SUCCESS>
            } else {
                <FAILURE: You can not see members of a private chat if you don't belong there>
            }
        }
        
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
app.get(constants.prefix + '/api/chat/:id/members', async (req, res) => {
    
    try {
        
        let chatID = stringToUInteger(req.params["id"]);
        if(!chatID) error(400, 'Expected URL: api/chat/<CHAT ID>/members');

        if(!await chatIDExists(chatID)) error(404, "This chat doesn't exist");
        
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
            (msg) => { res.status(400).send({message: msg}); },
            // On parameter of invalid type:
            (msg) => { res.status(400).send({message: msg}); },
            // On parameter breaking rules:
            (msg) => { res.status(400).send({message: msg}); }
        );
        
        if(!parameters) {
            return;
        }
    
        let isPublic = await isChatPublic(chatID);
        
        if(!isPublic) {
            let { token } = req.body;
            guard('StrTkn', token, 'token');
            
            let userID = await getUserIDOfAccessToken(token);
            if(!userID) error(403, 'Invalid access token');
            
            let member = await isMember(userID, chatID);
            if(!member) error(403, 'This chat is private');
        }
        
        let data = await chatMembers(chatID, parameters["after"], parameters["before"], parameters["limit"]);
        let admin = await chatAdmin(chatID);
        if(!admin) error(500, 'Failed to find admin');
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({
            admin: admin["name"],
            adminID: admin["id"],
            members: data
        });
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    GET /rrchat/api/chat/:id

        AUTHORIZATION:
        if(chatIsPublic) {
            <SUCCESS>
        } else {
            if(belongsToGroup) {
                <SUCCESS>
            } else {
                <FAILURE: You can not see members of a private chat if you don't belong there>
            }
        }
        
        RESPONSE:
        {
            "id": <CHAT ID>,
            "name": <CHAT NAME>,
            "admin": <CHAT ADMIN NAME>,
            "adminID": <CHAT ADMIN ID>,
            "public": <IS PUBLIC>,
            "requestToJoin": <IS REQUEST TO JOIN>,
            "created": <CREATED TIMESTAMP>,
            "members": <NUMBER OF MEMBERS>,
            "isMember:" <IS MEMBER (0, if not autorized)>
        }
*/
app.get(constants.prefix + '/api/chat/:id', async (req, res) => {
    
    try {
        
        let chatID = stringToUInteger(req.params["id"]);
        if(!chatID) error(400, 'Expected URL: api/chat/<CHAT ID>');
        
        if(!await chatIDExists(chatID)) error(404, "This chat doesn't exist");
    
        let isPublic = await isChatPublic(chatID);
        
        let { token } = req.body;
        let userID = 0;
        if(token) {
            guard('StrTkn', token, 'token');
            
            userID = await getUserIDOfAccessToken(token);
            if(!userID) error(403, 'Invalid access token');
        }
        
        if(!isPublic) {
            let member = await isMember(userID, chatID);
            if(!member) error(403, 'This chat is private');
        }
        
        let data = await chatInfo(chatID, userID);
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json(data);
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    POST /rrchat/api/chat/:id/join
        AUTHORIZATION:
            if(chatExists(..)) {
                if(belongsInChat(..)) {
                    <FAILURE: You are already an member of this chat>
                } else {
                    getChatData(chatID) {
                        if(isRequestToJoin) {
                            if(requestExists(userID, chatID)) {
                                <FAILURE: You have already submitted a request>
                            } else {
                                <SUCCESS: Join request sent>
                            }
                        } else {
                            if(isPublic) {
                                <SUCCESS: Chat joined>
                            } else {
                                <FAILURE: This chat is private>
                            }
                        }
                    }
                }
            } else {
                <FAILURE: Chat with this ID doesn't exist>
            }
        
        RESPONSE:
        {
            "joined": <SUCCESS (TRUE if join was successful)>,
            "requestID": <REQUEST ID (if request was sent, 0 otherwise)>
        }
*/
app.get(constants.prefix + '/api/chat/:id/join', async (req, res) => {
    
    try {
        // Will be sent back to client:
        let sentRequestID = 0;
        let chatJoined = false;
        
        
        
        let chatID = stringToUInteger(req.params["id"]);
        if(!chatID) error(400, 'Expected URL: api/chat/<CHAT ID>/join');
        
        let { token } = req.body;
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
        let info = await chatInfo(chatID, userID);
        if(!info) error(404, "This chat doesn't exist");
        
        let invitationID = 0;
        
        // If already a member
        if(info["isMember"]) error(409, 'You are already a member of this chat');
        
        // If user has invitation from admin
        else if(invitationID = await invitationExists(info["adminID"], userID, chatID)) {
            await joinChat(chatID, userID);
            await deleteInvitation(invitationID);
            chatJoined = true;
        } 
        
        // If chat is requestToJoin
        else if(info["requestToJoin"]) {            
            let invitationID = 0;
            
            // If user has sent a request
            if(await requestExists(chatID, userID)) {
                error(409, 'Request already sent');
            } else 
            
            // If user hasn't sent a request
            {
                sentRequestID = await createRequest(chatID, userID);
            }
        } else
        
        // If chat is public
        if(info["public"]) {
            await joinChat(chatID, userID);
            chatJoined = true;
        } else 
        
        // If chat is not public
        {
            error(403, 'This chat is private');
        }
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({
            success: chatJoined,
            requestID: sentRequestID
        });
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    POST /rrchat/api/chat/:id/leave
        AUTHORIZATION:            
            if(belongsInChat(..)) {
                <SUCCESS>
            } else {
                <FAILURE: You are not an member of this chat>
            }
        
        RESPONSE:
        {
            "successful": <WAS LEAVING SUCCESSFUL>
        }
*/
app.post(constants.prefix + '/api/chat/:id/leave', async (req, res) => {
    
    try {
        
        let chatID = stringToUInteger(req.params["id"]);
        if(!chatID) error(400, 'Expected URL: api/chat/<CHAT ID>/leave');
        
        let { token } = req.body;
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
        let exists = await chatIDExists(chatID);
        if(!exists) error(404, "This chat doesn't exist");
        
        let admin = await chatAdmin(chatID);
        if(admin == userID) error(400, 'Please transfer ownership before leaving');
        
        let member = await isMember(userID, chatID);
        if(!member) error(400, 'You are not a member of this chat');
        
        let success = await leaveChat(chatID, userID);
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ success: success });
    } catch(e) {
        handleResponseError(e, res);
    }
});
/*
    Responds to:
    POST /rrchat/api/create/chat
        AUTHORIZATION:
            required

        REQUEST:
        {
            "name": <CHAT NAME>,
            "public": <IS CHAT PUBLIC>,
            "requestToJoin": <IS CHAT REQUEST-TO-JOIN>
        }
        
        RESPONSE:
        {
            "chatID": <CHAT ID>
        }
*/
app.post(constants.prefix + '/api/create/chat', async (req, res) => {
    
    try {
        let { token, name, visibility, requestToJoin } = req.body;
        
        // Authentication
        
        guard('StrTkn', token, 'token');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
        // Guards
        
        guard('StrLen', name, 'name');
        guard('Boolean', visibility, 'visibility');
        guard('Boolean', requestToJoin, 'requestToJoin');
        
        if(!/^[a-zA-Z0-9 _\-]+$/.test(name))
            error(400, "Chat's name can only contain letters, numbers, spaces, hyphens and underscores");
        
        
        let exists = await getChatID(name);
        if(exists) error(400, 'Chat with this name already exists');
        
        // Data insertion
        
        let success = await createChat(name, visibility, requestToJoin, userID);
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ success: success });
    } catch(e) {
        handleResponseError(e, res);
    }
});

/*
    Responds to:
    POST /rrchat/api/chat/:id/invite
        AUTHORIZATION:
            required
            
            if(belongsInChat(..)) {
                <SUCCESS>
            } else {
                <FAILURE: You are not an member of this chat>
            }
        
        REQUEST: 
        {
            "invitee": <USER ID>
        }
        
        RESPONSE:
        {
            "successful": <WAS INVITE SUCCESSFUL>,
            "invitationID": <INVITATION ID>
        }
*/
app.get(constants.prefix + '/api/chat/:id/invite', async (req, res) => {
    
    try {
        // Will be sent back to client:
        let invitationSent = false;
        let invitationID = 0;
        
        // Guards
        let chatID = stringToUInteger(req.params["id"]);
        if(!chatID) error(400, 'Expected URL: api/chat/<CHAT ID>/invite');
        
        let { token, invitee } = req.body;
        guard('StrTkn', token, 'token');
        guard('Number', invitee, 'invitee');
        if(!invitee) error(400, 'Bad or missing invitee ID');
        
        let userID = await getUserIDOfAccessToken(token);
        if(!userID) error(403, 'Invalid access token');
        
        let info = await chatInfo(chatID, userID);
        if(!info) error(404, "This chat doesn't exist");
        
        if(!info["isMember"]) error(403, 'You are not a member of this chat');
        
        if(await invitationExists(userID, invitee, chatID))
            error(409, 'Invitation already sent');
        
        // Data insertion
        invitationID = await createInvitation(userID, invitee, chatID);
        invitationSent = !!invitationID;
        
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({
            success: invitationSent,
            invitationID: invitationID
        });
    } catch(e) {
        handleResponseError(e, res);
    }
});


}
