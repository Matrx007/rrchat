// error_handling.js
// #################

const { typeCheck } = require('./tools.js');

module.exports = {

// ##############################
// # ERROR HANDLING             #
// ##############################

ResponseError: class extends Error {
    constructor(message, responseCode, responseMessage) {
        super(message);
        this.isProblematic = message && true;
        this._responseCode = responseCode;
        this._responseMessage = responseMessage;
    }
    
    get responseCode() {
        return this._responseCode;
    }

    get responseMessage() {
        return this._responseMessage;
    }
},

error: function(status, msg) {
    throw new module.exports.ResponseError(
        null,
        status,
        msg
    );
},

/**
    @param {ResponseError} err  Thrown error which was catched by the catch(e) {..} statement
    @param {res} res            ExpressJS response parameter where response will be sent to
    
    Meant to be called inside catch(e) {..} statement.
*/
handleResponseError: function(err, res) {
    if(!err) {
        console.error("null error");
        
        res.status(500).send({message: 'Unknown error'});
    } else if(err instanceof module.exports.ResponseError) {
        if(err.isProblematic) {
            console.error("err: ", err.message);
            console.error(`response (${err.responseCode}): `, err.responseMessage);
        }
        
        res.status(err.responseCode).send({message: err.responseMessage});
    } else {
        console.error(err);
        res.status(500).send({message: 'Unknown problem'});
    }
}

}
