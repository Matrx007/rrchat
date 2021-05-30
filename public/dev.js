/* eslint-disable */
var socket = io.connect('https://rainisr.ee', { path: '/rrchat/socket.io' });





const app = Vue.createApp({
    data() {
        return {
            // User information
            username: '-',
            loggedIn: false,

            // State
            showCreateAccount: false,
            waitingToBeLoggedIn: false,
            waitingToBeLoggedOut: false,
            waitingToBeRegistered: false,

            groupsNewestTimestamp: 0,
            groupsOldestTimestamp: 0,
            groups: [
                // name, last message, chatID                
            ],

            invitationsNewestTimestamp: 0,
            invitationsOldestTimestamp: 0,
            invitations: [
                // name, inviter, chatID, invitationID
            ],

            discoverGroupsResultsNewestTimestamp: 0,
            discoverGroupsResultsOldestTimestamp: 0,
            discoverGroupsSearchInput: '',
            discoverGroupsSearch: '',
            discoverGroupsResults: [
                // name, members, joined, chatID, requestToJoin
            ],

            // Create a group
            showCreateGroup: false,
            createGroupIsNameTaken: -1,
            createGroupNameInput: '',
            createGroupName: '',
            createGroupIsPublic: false,
            createGroupRequestToJoin: false,

            // Logging-in
            logInUsername: '',
            logInPassword: '',
            logInMessage: '',

            // Registering
            registerUsername: '',
            registerPassword: '',
            registerPasswordRepeated: '',
            registerPasswordMismatch: false,
            registerMessage: '',

            // GUI
            showDiscoverGroups: false
        }
    },
    methods: {

        // ### GUI ACTIONS ###

        gui_logIn() {
            this.loginMessage = '';
            this.request_logIn({
                "username": this.logInUsername, 
                "password": this.logInPassword
            });
            this.logInUsername = '';
            this.logInPassword = '';
            this.waitingToBeLoggedIn = true;

            // simulating server response
            let vue = this;
            setTimeout(function() {
                vue.response_loggedIn({nickname: "John Doe"});
            }, 1000);
        },

        gui_register() {
            this.registerMessage = '';
            if(this.registerPassword != this.registerPasswordRepeated) {
                this.registerMessage = "Passwords don't match";
                return;
            }

            this.request_register({
                "username": this.registerUsername, 
                "password": this.registerPassword
            });
            this.registerUsername = '';
            this.registerPassword = '';
            this.registerPasswordRepeated = '';
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

        gui_discoverGroupsJoin(group) {
            console.log(group);
            this.request_discoverGroupsJoin(group);

            // simulating server response
            let vue = this;
            setTimeout(function() {
                vue.response_discoverGroupsJoin(group);
            }, 1000);
        },

        gui_discoverGroupsSearch() {
            this.discoverGroupsSearch = this.discoverGroupsSearchInput;
            this.request_discoverGroupsSearch(this.discoverGroupsSearch);
        },

        gui_createGroupCheck() {
            this.createGroupName = this.createGroupNameInput;
            this.request_createGroupCheck(this.createGroupName);

            let vue = this;
            setTimeout(() => {
                let random = Math.round(Math.random()*1);
                console.log(random);
                vue.reponse_createGroupCheck(random);
            }, 100);
        },

        gui_createGroup() {
            let data = {
                "name": this.createGroupName,
                "isPublic": this.createGroupIsPublic,
                "requestToJoin": this.createGroupRequestToJoin
            };

            console.log(data);

            this.request_createGroup(data);
        },

        // ### CLIENT ACTIONS ###

        request_logIn(username, password) {
            // TODO: send request to server
        },
        request_logOut() {
            // TODO: send request to server
        },

        request_groupsFeed(oldestTimestamp = 0) {
            if(oldestTimestamp) {
                // TODO: send request to server
            } else {
                // TODO: send request to server
            }
        },

        request_discoverGroups(oldestTimestamp = 0) {
            if(oldestTimestamp) {
                // TODO: send request to server
            } else {
                // TODO: send request to server
            }
        },

        request_discoverGroupsSearch(search, oldestTimestamp = 0) {
            if(oldestTimestamp) {
                // TODO: send request to server
            } else {
                // TODO: send request to server
            }
        },

        request_discoverGroupsJoin(group) {
            // TODO: send request to server
        },

        request_createGroupCheck(name) {
            // TODO: send request to server
        },

        request_createGroup(data) {
            // TODO: send request to server
        },

        request_register(data) {
            // TODO: send request to server
        },


        // ### SERVER RESPONSES ###

        response_loggedIn(data) {
            if("nickname" in data) {
                this.username = data["nickname"];
                this.loggedIn = true;
                this.waitingToBeLoggedIn = false;

                this.request_groupsFeed();
            } else {
                this.waitingToBeLoggedIn = false;
                this.logInMessage = data["message"];
            }
        },

        response_loggedOut() {
            this.logInUsername = '';
            this.logInPassword = '';
            this.groups = [];
            this.invitations = [];
            this.loggedIn = false;
            this.waitingToBeLoggedOut = false;
        },

        response_invitationsFeed(data) {
            if(data["append"] == true) {
                data["invitations"].forEach(invitation => {
                    if("timestamp" in invitation) {
                        if(invitation["timestamp"] < invitationsOldestTimestamp) {

                            // If this invitation is the oldest one, add it to the end
                            invitations.push(invitation);
                            invitationsOldestTimestamp = invitation["timestamp"];
                        } else if(invitation["timestamp"] > invitationsNewestTimestamp) {

                            // If this invitation is the newestone, add it to the beginning
                            invitations.unshift(invitation);
                            invitationsNewestTimestamp = invitation["timestamp"];
                        } else {

                            // If this invitation is somewhere between, find the right spot
                            let numinvitations = invitations.length;
                            for(let i = 0; i < numinvitations; i++) {
                                if(invitation["timestamp"] < invitations[i]["timestamp"]) {
                                    invitations.splice(i, 0, invitation);
                                    break;
                                }
                            }
                        }
                    }
                });
            } else if(data["append"] == false) {
                this.invitations = data["invitations"];
                this.invitations.sort((invitationA, invitationB) => {
                    invitationA["timestamp"] - invitationB["timestamp"];
                });
                this.invitations.forEach(invitation => {
                    this.invitationsOldestTimestamp = Math.min(
                        this.invitationsOldestTimestamp,
                        invitation["timestamp"]
                    );
                    this.invitationsNewestTimestamp = Math.max(
                        this.invitationsNewestTimestamp,
                        invitation["timestamp"]
                    );
                });
            }
        },

        response_groupsFeed(data) {
            if(data["append"] == true) {
                data["groups"].forEach(group => {
                    if("timestamp" in group) {
                        if(group["timestamp"] < groupsOldestTimestamp) {

                            // If this group is the oldest one, add it to the end
                            groups.push(group);
                            groupsOldestTimestamp = group["timestamp"];
                        } else if(group["timestamp"] > groupsNewestTimestamp) {

                            // If this group is the newestone, add it to the beginning
                            groups.unshift(group);
                            groupsNewestTimestamp = group["timestamp"];
                        } else {

                            // If this group is somewhere between, find the right spot
                            let numgroups = groups.length;
                            for(let i = 0; i < numgroups; i++) {
                                if(group["timestamp"] < groups[i]["timestamp"]) {
                                    groups.splice(i, 0, group);
                                    break;
                                }
                            }
                        }
                    }
                });
            } else if(data["append"] == false) {
                this.groups = data["groups"];
                this.groups.sort((groupA, groupB) => {
                    groupA["timestamp"] - groupB["timestamp"];
                });
                this.groups.forEach(group => {
                    this.groupsOldestTimestamp = Math.min(
                        this.groupsOldestTimestamp,
                        group["timestamp"]
                    );
                    this.groupsNewestTimestamp = Math.max(
                        this.groupsNewestTimestamp,
                        group["timestamp"]
                    );
                });
            }
        },

        response_discoverGroupsResultsFeed(data) {
            if(data["append"] == true) {
                data["discoverGroupsResults"].forEach(discoverGroupsResult => {
                    if("timestamp" in discoverGroupsResult) {
                        if(discoverGroupsResult["timestamp"] < discoverGroupsResultsOldestTimestamp) {

                            // If this discoverGroupsResult is the oldest one, add it to the end
                            discoverGroupsResults.push(discoverGroupsResult);
                            discoverGroupsResultsOldestTimestamp = discoverGroupsResult["timestamp"];
                        } else if(discoverGroupsResult["timestamp"] > discoverGroupsResultsNewestTimestamp) {

                            // If this discoverGroupsResult is the newestone, add it to the beginning
                            discoverGroupsResults.unshift(discoverGroupsResult);
                            discoverGroupsResultsNewestTimestamp = discoverGroupsResult["timestamp"];
                        } else {

                            // If this discoverGroupsResult is somewhere between, find the right spot
                            let numdiscoverGroupsResults = discoverGroupsResults.length;
                            for(let i = 0; i < numdiscoverGroupsResults; i++) {
                                if(discoverGroupsResult["timestamp"] < discoverGroupsResults[i]["timestamp"]) {
                                    discoverGroupsResults.splice(i, 0, discoverGroupsResult);
                                    break;
                                }
                            }
                        }
                    }
                });
            } else if(data["append"] == false) {
                this.discoverGroupsResults = data["discoverGroupsResults"];
                this.discoverGroupsResults.sort((discoverGroupsResultA, discoverGroupsResultB) => {
                    discoverGroupsResultA["timestamp"] - discoverGroupsResultB["timestamp"];
                });
                this.discoverGroupsResults.forEach(discoverGroupsResult => {
                    this.discoverGroupsResultsOldestTimestamp = Math.min(
                        this.discoverGroupsResultsOldestTimestamp,
                        discoverGroupsResult["timestamp"]
                    );
                    this.discoverGroupsResultsNewestTimestamp = Math.max(
                        this.discoverGroupsResultsNewestTimestamp,
                        discoverGroupsResult["timestamp"]
                    );
                });
            }
        },

        response_discoverGroupsJoin(group) {
            console.log("comparing against: ", group);
            this.discoverGroupsResults.some((g, i, arr) => {
            console.log("forEach vals: ", g, i, arr);
                if(g[3] == group[3]) {
                    arr[i][2] = true;
                    return true;
                }
            })
        },

        reponse_createGroupCheck(result) {
            this.createGroupIsNameTaken = result;
        },

        response_createGroup(data) {
            this.showCreateGroup = false;
            this.createGroupNameInput = '';
            this.createGroupName = '';
        },

        response_register(data) {
            if("nickname" in data) {
                this.username = data["nickname"];
                this.loggedIn = true;
                this.waitingToBeLoggedIn = false;

                this.request_groupsFeed();
            } else {
                this.waitingToBeLoggedIn = false;
                this.registerMessage = data["message"];
            }
        }
    }
});

console.log("works?");

app.mount("#app");