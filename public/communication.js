/* eslint-disable */

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


$('#login-panel form').submit(function(e) {
    e.preventDefault();
});
$('#register-panel form').submit(function(e) {
    e.preventDefault();
});
$('#msg').submit(function(e) {
    e.preventDefault();
});

$('#create-group-is-public').click(function(e) {
    $('#create-group-request-to-join').attr("disabled", !this.checked);
    if($('#create-group-request-to-join').attr("disabled")) {
       $('#create-group-request-to-join').prop("checked", false); 
    }
    $('#create-group-others-can-invite').attr("disabled", this.checked);
    if($('#create-group-others-can-invite').attr("disabled")) {
       $('#create-group-others-can-invite').prop("checked", false); 
    }
});

// ### UTILITIES ###

function decodeTimestamp(UNIX_timestamp) {
    let a = new Date(UNIX_timestamp * 1000);
    let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let year = a.getFullYear();
    let month = months[a.getMonth()];
    let date = a.getDate();
    let hour = a.getHours();
    let min = a.getMinutes();
    let sec = a.getSeconds();
    let time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min;
    return time;
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// ### DYNAMIC CONTENT ###

const reponseCodes = {
    "100": "Logged in",
    "101": "Registered",
    "102": "Joined group",
    "200": "Wrong password",
    "201": "User doesn't exist",
    "202": "Username breaks rules",
    "203": "Password breaks rules",
    "204": "Password too weak",
    "205": "Not logged in",
    "206": "Already logged in",
    "207": "Username is taken",
    "208": "Group is private",
    "209": "Already in group",
    "210": "Group name required",
    "211": "Invalid options",
    "212": "Group name taken"
};

function pushNotification(message, type) {
    let element = $(`
        <div class="message">
            ${message}
        </div>
    `);
    $('#notifications').prepend(element);
    element.fadeOut(2000, () => {
        element.remove();
    });
}


let socket = io.connect('https://rainisr.ee', { path: '/rrchat/socket.io' });

// Groups
let nickname = "Not logged in";
let groups = [];
let invitations = [];

// Chat
let lastMessageSender = null;
let topTimestamp = 0;

// Discover
let discoverSearchString = null;
let discoverTopIndex = 0;

socket.on("disconnect", () => {
    logOut();

    pushNotification("Connection lost");
    socket = null;
});


socket.on('data', (label, data) => {
    console.log("data: ", label, data);
    switch (label) {
        case "groups":
            if(!data) break;
            groups = groups.concat(data);

            // Insert labels
            if($('#group-list .groups .label').length == 0 && groups.length > 0) {
                $('#group-list .groups').prepend(`<h1 class="label">Groups</h1>`);
            }

            data.forEach((group) => {
                if(group["content"] == null) {
                    $('#group-list .groups').append(`<ul onclick="join('${group["name"]}')">
                        <h1>${group["name"]}</h1>
                    </ul>`);
                    return;
                }
                $('#group-list .groups').append(`<ul onclick="join('${group["name"]}')">
                    <h1>${group["name"]}</h1>
                    <p>${group["content"]}</p>
                </ul>`);
            });
            break;
        case "invitations":
            invitations = data;

            // Insert labels
            if($('#group-list .invitations .label').length == 0 && data.length > 0) {
                $('#group-list .invitations').prepend(`<h1 class="label">Invitations</h1>`);
            }

            data.forEach((invitation) => {
                $('#group-list .invitations').append(`<ul data-invitation-id="${invitation["id"]}" onclick="acceptInvite('${invitation["id"]}')">
                    <h1>${invitation["group"]}</h1>
                    <p>${invitation["inviter"]} invited you</p>
                </ul>`);
            });
            break;
        case "members":
            console.log("members: ", data);
            break;
        case "discover":
            if(data.length > 0) {
                data.forEach((group) => {
                    $('#discover-list').append(`
                        <ul data-group-id="${group["id"]}">
                            <div class="info">
                                <h1>${group["name"]}</h1>
                                <p>Members: ${group["members"] == null ? 0 : group["members"]}</p>
                            </div>

                            <div style="margin: 0 auto;"></div>

                            <div class="button ${group["isMember"] ? "disabled" : ""}" onclick="discoverJoin('${group["id"]}')">
                                <p>${group["isMember"] ? "Joined" : "Join"}</p>
                            </div>
                        </ul>
                    `);
                });
            }
            break;
    }
});

socket.on('chat message', (msg) => {
    let prefix = "";
    if(msg["sender"] == nickname) {
        prefix += "me";
    }

    console.log("same sender: ", lastMessageSender == msg["sender"]);
    if(lastMessageSender == msg["sender"]) {
        if(msg["sender"] != nickname)
            $('#messages').children().last().remove();
        $('#messages').append(`<li class="message stack ${prefix}" title="${decodeTimestamp(msg["timestamp"])}">${msg["content"]}</li>`);
        if(msg["sender"] != nickname)
            $('#messages').append(`<li class="sender ${prefix}" title="${decodeTimestamp(msg["timestamp"])}">${msg["sender"]}</li>`);
    } else {
        $('#messages').append(`<li class="message ${prefix}" title="${decodeTimestamp(msg["timestamp"])}">${msg["content"]}</li>`);
        if(msg["sender"] != nickname)
            $('#messages').append(`<li class="sender ${prefix}" title="${decodeTimestamp(msg["timestamp"])}">${msg["sender"]}</li>`);
    }
    lastMessageSender = msg["sender"];
    $('#messages').scrollTop($('#messages')[0].scrollHeight);
    if(msg.length > 0) {
        topTimestamp = msg[msg.length-1]["timestamp"];
    }

    // Updating last message
    /* console.log("changing last message");
    console.log("elements: ", $('#group-list').children('ul'));
    $('#group-list').children('ul').each(() => {
        console.log("inside: ", this);
        console.log("html: ", $(this).html());
        if($(this).children('h1').text() == $('#group')) {
            $(this).children('p').text(msg);
        }
    }); */
});

socket.on('do', (command, data) => {
    console.log("do: ", command, data);
    switch (command) {
        case "change group":
            console.log("changing group, data:", data);
            $('#chat').show();
            $('#login').hide();
            $('#register').hide();
            $('#groups').hide();

            $('#messages').empty();
            lastMessageSender = null;
            $('#group').text(data["name"]);
            break;
        default:
            break;
    }
});

socket.on('response', (code, data) => {
    console.log("response: ", code, data);
    pushNotification(reponseCodes[code]);
    switch (code) {
        case LOGGED_IN:
        case REGISTERED:
            $('#chat').hide();
            $('#login').hide();
            $('#register').hide();
            $('#groups').show();
            nickname = data["nickname"];
            $('#nickname').text(nickname);
            console.log("Log in / register successful");
            break;
        case USER_DOESNT_EXIST:
        case USERNAME_BREAKS_RULES:
        case PASSWORD_BREAKS_RULES:
        case PASSWORD_TOO_WEAK:
        case USERNAME_TAKEN:
        case WRONG_CREDENTIALS:
            $('#chat').hide();
            $('#login').show();
            $('#register').hide();
            $('#groups').hide();
            $('#login-button').prop('disabled', false);
            $('#nickname').text('Not logged in');
            console.log("Log in / register problem");
            break;
        case NOT_LOGGED_IN:
        case ALREADY_LOGGED_IN:
            console.log("Not logged in / already logged in");
            break;
        case DISCOVER_BECAME_MEMBER:
            if(data && data["id"]) {
                data["id"] = "" + data["id"];
                console.log("seraching for element with id: ", $('#discover-list').find(`[data-group-id="${data["id"]}"]`));
                $('#discover-list').find(`[data-group-id="${data["id"]}"] .button`).addClass("disabled").find('p').text("Joined");
                $('#discover-list').find(`[data-group-id="${data["id"]}"] .info p`).text((i, old) => {
                    return "Members: " + (parseInt(old.replace("Members: ", "")) + 1);
                });
            }
            break;
    
        default:
            break;
    }
});

function logIn() {
    if(socket != null && !socket.connected) {
        return;
    }

    if(socket == null) {
        socket = io();
        return;
    }

    $('#login-button').prop('disabled', true);
    $('#register-button').prop('disabled', true);
    socket.emit('login', $('#login-username').val(), $('#login-password').val());
    $('#login-username').val('');
    $('#login-password').val('');
}

function register() {
    if(socket != null && !socket.connected) {
        return;
    }
    
    if(socket == null) {
        socket = io();
        return;
    }

    if($('#register-password').val() == $('#register-password-again').val()) {
        console.log("Registering");
        $('#login-button').prop('disabled', true);
        $('#register-button').prop('disabled', true);
        socket.emit('register', $('#register-username').val(), $('#register-password').val());
        $('#register-username').val('');
        $('#register-password').val('');
    }
}

function logOut() {
    // reload() ?

    socket.emit('logout');
    nickname = "Not logged in";
    groups = [];
    invitations = [];
    topTimestamp = 0;

    $('#login-button').prop('disabled', false);
    $('#register-button').prop('disabled', false);

    $('#login').show();
    $('#register').hide();
    $('#chat').hide();
    $('#groups').hide();
    
    $('#messages').empty();
    lastMessageSender = null;
    $('#group-list .groups').empty();
    $('#group-list .invitations').empty();
}

function leaveChat() {
    $('#login').hide();
    $('#register').hide();
    $('#chat').hide();
    $('#groups').show();
    
    $('#messages').empty();
    lastMessageSender = null;
}

function submitMessage() {
    let msg = $('#m').val();
    socket.emit('chat message', msg);
    $('#m').val('');
}

function join(groupName) {
    console.log("going: "+groupName);
    groups.some((group) => {
        if(group["name"] == groupName) {
            console.log("found group");
            socket.emit('do', "go", { "group": group["id"] });
            return true;
        }
    });
}

function goToRegister() {
    $('#login').hide();
    $('#register').show();
}

function goToLogin() {
    $('#login').show();
    $('#register').hide();
}

function openDiscover() {
    $('#discover').show();

    $('#discover-list').empty();
    socket.emit('do', 'discover', { "search": null, "start": 0 });
}

function closeDiscover() {
    $('#discover').hide();
    $('#discover .search input:text').val('');
}

function discoverSearch() {
    discoverSearchString = $('#discover .search input:text').val();
    if(discoverSearchString.length == 0) discoverSearchString = null;
    discoverTopIndex = 0;

    let data = {
        "search": discoverSearchString,
        "start": discoverTopIndex
    };

    $('#discover-list').empty();
    socket.emit('do', 'discover', data);
}

function discoverJoin(id) {
    socket.emit('do', "request-member", {
        "id": id
    });
}

function acceptInvite(id) {
    socket.emit('do', "accept-invite", {
        "id": id
    });

    $('#group-list .invitations').find(`[data-invitation-id="${id}"]`).remove();
    if($('#group-list .invitations').children().length == 1) {
        $('#group-list .invitations h1').remove();
    }
}

function createGroup() {

    let data = {
        "name": $('#create-group-name').text()
    }

    if(data["name"].length == 0) {
        pushNotification("Enter group name");
        return;
    }
    
    data["public"] = $('#create-group-is-public').prop("checked");
    data["request-to-join"] = data["public"] && $('#create-group-is-public').prop("checked");
    data["others-can-invite"] = !data["public"] && $('#create-group-is-public').prop("checked");

    socket.emit('do', "create-group", data);
}