// tools.js
// #######

const { ResponseError } = require('./error_handling.js');

module.exports = {

typeCheckLib: require("type-check").typeCheck,

// ##############################
// # SETTINGS                   #
// ##############################

typeCheckOptions: {
    customTypes: {
        StrNum: {
            typeOf: 'String',
            validate: (str) => !isNaN(str)
        },
        StrLen: {
           typeOf: 'String',
           validate: (str) => str.length > 0 
        }
    }
},

typeCheck: function(template, data) {
    return this.typeCheckLib(template, data, this.typeCheckOptions);
},


/**
    @param {template} template  Template to check given data against
    @param {any} data           Data to be checked
    
    @returns { statusCode: Number, message: String }
    
    Checks given data against given template. 
*/
guard: function(template, data, property = null) {
    if(!module.exports.typeCheck(template, data))
        throw new ResponseError(
            null,
            400,
            "Bad or missing request data" + (property && `: ${property}`)
        );
},

// #####################################
// # UTILITY FUNCTIONS                 #
// #####################################

/**
    @param {String} string  String containing an positiv or negative integer
    @returns {Number}       String converted to positive or negative <integer> or <undefined> if not possible
*/
stringToInteger: function(string) {
    if (typeof string === 'string')
        return /^-?\d+$/.test(string) ? parseInt(string, 10) : undefined;
},

/**
    @param {String} string  String containing an positiv integer
    @returns {Number}       String converted to positive <integer> or <undefined> if not possible
*/
stringToUInteger: function(string) {
    if (typeof string === 'string')
        return /^\d+$/.test(string) ? parseInt(string, 10) : undefined;
},


// #####################################
// # DATA VALIDATION                   #
// #####################################

validateID: function(id) {
    if(isNaN(id)) {
        throw new Error("ID is not a number");
    }
    
    if(!Number.isInteger(id)) {
        throw new Error("ID is not an integer");
    }
},

/**    
    data:
    @param  {Object} template   Table containing type and default values to all possible parameters
    @param  {Object} data       Input data which will be initialized
    callbacks:
    @param  {Function} ifUnknownParameter       Called if unknown parameter is given
    @param  {Function} ifParameterInvalidType   Called if parameter of invalid type is given
    @param  {Function} ifParameterBreaksRules   Called if parameter breaks rules set in template 
                                                (above maximum, below minimum etc)
    
    @return {Object}    Returns object containing initialized parameters 
                        or null if any given parameter isn't mentioned in
                        the template
    
    This function is used to easily initialize uninitialized URL parameters stored as strings.
    
    Syntax of template:
    {
        parameter: { type: 'Number' or 'String', default: number or string, ?max: number, ?min: number },
        ..
    }
    
    Example template:
    {
        before:     { type: 'StrNum', default: 4294967295,  min: 0, max: 4294967295},
        after:      { type: 'StrNum', default: 0,           min: 0, max: 4294967295},
        query:      { type: 'String', default: ''},
        limit:      { type: 'StrNum', default: 30,          min: 1, max: 30}
    }
*/
initializeParameters: function(template, data, ifUnknownParameter, ifParameterInvalidType, ifParameterBreaksRules) {
    
    /*
        template:
        {
            "parameter1": { type: 'Number', default: 238479 },
            "parameter2": { type: 'String', default: 'none' }
        }
    */
    
    let results = {};
    
    for(let key in template) {
        results[key] = template[key]["default"];
        
        if(template[key]["type"] == 'StrNum') {
            if(template[key].hasOwnProperty("max")) {
                if(template[key]["default"] > template[key]["max"]) {
                    console.log(`Problem in template at '${key}': default > max`);
                    process.exit(1);
                    continue;
                }
            }
            
            if(template[key].hasOwnProperty("min")) {
                if(template[key]["default"] < template[key]["min"]) {
                    console.log(`Problem in template at '${key}': default < min`);
                    process.exit(1);
                    continue;
                }
            }
        }
    }
    
    for(let key in data) {
        if(template.hasOwnProperty(key)) {
            
            // Make sure parameter in template contains 'type' and 'default' key
            if(!template[key].hasOwnProperty("type")) {
                console.log(`Problem in template at '${key}': missing 'type' property`);
                process.exit(1);
                continue;
            }
            if(!template[key].hasOwnProperty("default")) {
                console.log(`Problem in template at '${key}': missing 'default' property`);
                process.exit(1);
                continue;
            }
            
            // Check if correct type
            if(!this.typeCheck(template[key]["type"], data[key])) {
                ifParameterInvalidType(`Parameter '${key}' is of invalid type`);
                return null;
            }
            
            // Number type
            if(template[key]["type"] == 'StrNum') {
                
                // Initialize if uninitialized
                results[key] = data[key] ? this.stringToInteger(data[key]) : template[key]["default"];
                
                if(template[key].hasOwnProperty("max")) {
                    if(results[key] > template[key]["max"]) {
                        ifParameterBreaksRules(`Parameter '${key}' above its maximum (${template[key]["max"]})`);
                        return null;
                    }
                }
                
                if(template[key].hasOwnProperty("min")) {
                    if(results[key] < template[key]["min"]) {
                        ifParameterBreaksRules(`Parameter '${key}' below its minimum (${template[key]["min"]})`);
                        return null;
                    }
                }
            }
            
            // String type
            if(template[key]["type"] == 'String') {
                // String can't have 'max' or 'min' property
                if(template[key].hasOwnProperty("max")) {
                    console.log(`Problem in template at '${key}': String can't have 'max' property`);
                    process.exit(1);
                    continue;
                }
                if(template[key].hasOwnProperty("min")) {
                    console.log(`Problem in template at '${key}': String can't have 'min' property`);
                    process.exit(1);
                    continue;
                }
                
                // Initialize if uninitialized
                results[key] = data[key] || template[key]["default"];
            }
        } else {
            ifUnknownParameter(`Unknown parameter: '${key}'`);
            return null;
        }
    }
    
    return results;
},

// #####################################
// # COMMUNICATION                     #
// #####################################

/**
    @param {ExpressJS res} res  Where response will be sent
    @param {JSONObject} data    Data which will be sent
    
    Responds with status code 200 and sends a JSON response.
*/
respond: function(res, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    res.json(data);
}

}
