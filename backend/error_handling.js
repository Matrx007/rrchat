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

/**
    @param {ResponseError} err  Thrown error which was catched by the catch(e) {..} statement
    @param {res} res            ExpressJS response parameter where response will be sent to
    
    Meant to be called inside catch(e) {..} statement.
*/
handleResponseError: function(err, res) {
    if(!err) {
        console.error("null error");
    } else if(err instanceof module.exports.ResponseError) {
        console.error("err: ", err.message);
        console.error(`response (${err.responseCode}): `, err.responseMessage);
        
        res.status(err.responseCode).send({message: err.responseMessage});
    } else {
        console.error(err);
    }
},

/**
    @param {template} template  Template to check given data against
    @param {any} data           Data to be checked
    
    @returns { statusCode: Number, message: String }
    
    Checks given data against given template. 
*/
guard: function(template, data) {
    if(!typeCheck(template, data))
        throw new module.exports.ResponseError(
            null,
            400,
            "Invalid request data"
        );
}

}
