const constants = {
        
    // ##############################
    // # CONSTANTS                  #
    // ##############################

    prefix: '/rrchat/dev',


    // ##############################
    // # CLIENT-SERVER STATUS CODES #
    // ##############################

    LOGGED_IN: 100,
    REGISTERED: 101,
    DISCOVER_BECAME_MEMBER: 102,
    WRONG_CREDENTIALS: 200,
    USER_DOESNT_EXIST: 201,
    USERNAME_BREAKS_RULES: 202,
    PASSWORD_BREAKS_RULES: 203,
    PASSWORD_TOO_WEAK: 204,
    NOT_LOGGED_IN: 205,
    ALREADY_LOGGED_IN: 206,
    USERNAME_TAKEN: 207,
    PRIVATE_GROUP: 208,
    ALREADY_IN_GROUP: 209,
    GROUP_NAME_REQUIRED: 210,
    INVALID_OPTIONS: 211,
    GROUP_NAME_TAKEN: 212
    
};

module.exports.constants = constants;
