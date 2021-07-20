
const { constants } = require('./constants.js');

// ##############################
// # NODE MODULES               #
// ##############################

const express = require('express');

// ##############################
// # SOCKETS                    #
// ##############################

// Express.js

let app = express();
let http = require('http').Server(app);
// production: 3802
let port = process.env.PORT || 3789;

app.use(express.json());

app.get(constants.prefix, function(req, res) {
	res.sendFile(__dirname + '/views/restful.html')
})

app.use(constants.prefix + '/public', express.static('./public'));

function errorHandler (err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    
    res.setHeader("Content-Type", "application/json");
    res.status(500);
    res.json({message: "Invalid request"});
}

app.use(errorHandler);

// Socket.io

let io = require('socket.io')(http, { path: '/rrchat/socket.io', origins: '*:*' });

require('./api.js').bind(app);

// #####################################
// # START LISTENERS                   #
// #####################################

// http server listening for requests on port 3789
http.listen(port, function(){
    console.log('listening on *:3789');
});
