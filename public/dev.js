
var socket = io.connect('https://rainisr.ee', { path: '/rrchat/socket.io' });

const app = Vue.createApp({
    data() {
        return {
            // User information
            username: '-',
            loggedIn: false,
            waitingToBeLoggedIn: false,
            waitingToBeLoggedOut: false,
            groups: [
                ["My group 1", "Last message", 69],
                ["My group 2", "Last message", 69],
                ["My group 3", "Last message", 69],
                ["My group 4", "Last message", 69],
                ["My group 5", "Last message", 69],
                ["My group 6", "Last message", 69],
                ["My group 7", "Last message", 69],
                ["My group 8", "Last message", 69],
                ["My group 9", "Last message", 69],
                ["My group 10", "Last message", 69],
                ["My group 11", "Last message", 69],
                ["My group 12", "Last message", 69],
                ["My group 13", "Last message", 69],
                ["My group 14", "Last message", 69],
                ["My group 15", "Last message", 69],
                ["My group 16", "Last message", 69],
                ["My group 17", "Last message", 69],
                ["My group 18", "Last message", 69],
                ["My group 19", "Last message", 69],
                ["My group 20", "Last message", 69],
                ["My group 21", "Last message", 69],
                ["This is an incredibly long or should I say, incredibly lengthy group name", "Last message", 69]
            ],
            invitations: [
                ["Group 23", "John Doe", 69, 1273],
                ["Group 24", "John Doe", 69, 1273],
                ["Group 25", "John Doe", 69, 1273],
                ["Group 26", "John Doe", 69, 1273],
                ["Group 27", "John Doe", 69, 1273],
                ["Group 28", "John Doe", 69, 1273]
            ],
            discoverGroupsResults: [
                // name,        members,joined, chatid, requestToJoin
                ["Group 95",    13,     false,  200,    false],
                ["Group 80",    15,     true,   182,    true ],
                ["Group 100",   14,     false,  185,    true ],
                ["Group 50",    8,      true,   103,    false],
                ["Group 51",    12,     false,  164,    false],
                ["Group 50",    27,     false,  123,    false],
                ["Group 65",    16,     false,  184,    false],
                ["Group 35",    10,     true,   175,    true ],
                ["Group 35",    26,     false,  171,    false],
                ["Group 31",    3,      false,  154,    true ],
                ["Group 57",    18,     true,   102,    false],
                ["Group 72",    3,      false,  176,    true ],
                ["Group 80",    18,     true,   182,    true ],
                ["Group 49",    12,     false,  199,    true ],
                ["Group 85",    12,     false,  120,    false],
                ["Group 46",    20,     true,   147,    false],
                ["Group 58",    27,     false,  116,    false]
            ],

            // Logging-in
            loginUsername: 'Rainis',
            loginPassword: '',

            // GUI
            showDiscoverGroups: false
        }
    },
    methods: {

        // ### GUI ACTIONS ###

        gui_logIn() {
            this.request_logIn(this.loginUsername, this.loginPassword);
            this.loginUsername = '';
            this.loginPassword = '';
            this.waitingToBeLoggedIn = true;

            // simulating server response
            let vue = this;
            setTimeout(function() {
                vue.response_loggedIn({nickname: "John Doe"});
            }, 1000);
        },

        gui_logOut() {
            this.request_logOut();
            this.waitingToBeLoggedOut = true;

            // simulating server response
            let vue = this;
            setTimeout(function() {
                vue.response_loggedOut();
            }, 1000);
        },

        // ### CLIENT ACTIONS ###

        request_logIn(username, password) {
            // TODO: send request to server
        },
        request_logOut() {
            // TODO: send request to server
        },

        request_groupsFeed(offset = 0) {
            if(offset) {
                // TODO: send request to server
            } else {
                // TODO: send request to server
            }
        },

        request_discoverGroups(offset = 0) {
            if(offset) {
                // TODO: send request to server
            } else {
                // TODO: send request to server
            }
        },

        // ### SERVER RESPONSES ###

        response_loggedIn(data) {
            this.username = data["nickname"];
            this.loggedIn = true;
            this.waitingToBeLoggedIn = false;
        },

        response_loggedOut(data) {
            this.loginUsername = '';
            this.loginPassword = '';
            this.groups = [];
            this.invitations = [];
            this.loggedIn = false;
            this.waitingToBeLoggedOut = false;
        },

        response_groupsFeed(data) {
            if(data["append"] == true) {
                this.groups = this.groups.concat(data["groups"]);
            } else if(data["append"] == false) {
                this.groups = data["groups"];
            }
        },

        response_discoverGroups(data) {
            if(data["append"] == true) {
                this.groups = this.groups.concat(data["groups"]);
            } else if(data["append"] == false) {
                this.groups = data["groups"];
            }
        }
    }
});

console.log("works?");

app.mount("#app");