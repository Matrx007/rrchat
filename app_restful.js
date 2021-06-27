* eslint-disable */
// server.js
// express initializes variable app to be a function handler that you can supply an HTTP server

// ##############################
// # CONSTANTS                  #
// ##############################

const prefix = '/rrchat/dev';

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
// # SOCKETS                    #
// ##############################

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http, { path: '/rrchat/socket.io', origins: '*:*' });
var port = process.env.PORT || 3802;


app.get('/rrchat/dev', function(req, res) {
	res.sendFile(__dirname + '/views/restful.html')
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
    process.exit(1);
  }

  console.log('Connected to the MySQL server.');
});


// #####################################
// # REST API METHODS                  #
// #####################################



