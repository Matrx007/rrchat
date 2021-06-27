/* eslint-disable */
var socket = io.connect('https://rainisr.ee', { path: '/rrchat/socket.io' });
let appInside = null;
const app = Vue.createApp({
    data() {
        return {
            // User information
            username: '-',
            userID: 0,
            loggedIn: false,

            // State
            showCreateAccount: false,
            waitingToBeLoggedIn: false,
            waitingToBeLoggedOut: false,
            waitingToBeRegistered: false,

            groupsNewestTimestamp: 0,
            groupsOldestTimestamp: 0,
            groups: [
                // { id, name, message } ..               
            ],

            invitationsNewestTimestamp: 0,
            invitationsOldestTimestamp: 0,
            invitations: [
                // { id, inviter, group } ..
            ],

            discoverGroupsResultsNewestTimestamp: 0,
            discoverGroupsResultsOldestTimestamp: 0,
            discoverGroupsSearchInput: '',
            discoverGroupsSearch: '',
            discoverGroupsResults: [
                // { id, name, isMember, members } ..
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

            // chat
            showChat: false,
            showChatID: 0,
            showChatName: 'Group 1',
            message: '',
            messagesNewestTimestamp: 0,
            messagesOldestTimestamp: 0,
            messages: [
                // { id, type, content, timestamp, sender, senderID } ..
            ],

            // GUI
            showDiscoverGroups: false
        }
    },
    methods: {

        // ### GUI ACTIONS ###

        gui_logIn() {
            this.loginMessage = '';
            this.request_logIn(
                this.logInUsername, 
                this.logInPassword
            );
            this.logInUsername = '';
            this.logInPassword = '';
            this.waitingToBeLoggedIn = true;
        },

        gui_register() {
            this.registerMessage = '';
            if(this.registerPassword != this.registerPasswordRepeated) {
                this.registerMessage = "Passwords don't match";
                return;
            }

            this.request_register(
                this.registerUsername, 
                this.registerPassword
            );
            this.registerUsername = '';
            this.registerPassword = '';
            this.registerPasswordRepeated = '';
            this.waitingToBeLoggedIn = true;
        },

        gui_logOut() {
            this.request_logOut();
            this.waitingToBeLoggedOut = true;
        },

        gui_discoverGroupsJoin(group) {
            console.log(group);
            this.request_discoverGroupsJoin(group["id"]);
        },

        gui_discoverGroupsSearch() {
            this.discoverGroupsSearch = this.discoverGroupsSearchInput;
            this.request_discoverGroupsSearch(this.discoverGroupsSearch);
        },

        gui_createGroupCheck() {
            this.createGroupName = this.createGroupNameInput;
            this.request_createGroupCheck(this.createGroupName);
        },

        gui_createGroup() {
            this.request_createGroup(
                this.createGroupName,
                this.createGroupIsPublic,
                this.createGroupRequestToJoin
            );
        },
        
        gui_enterChat(id) {
            if(this.showChatID == id) {
                this.showChat = true;
                return;
            }
            this.request_enterChat(id);
        },
        
        gui_message() {
           this.request_message(0, this.message);
           this.message = '';
        },

        // ### CLIENT ACTIONS ###

        request_logIn(username, password) {
            socket.emit('logIn', {
                "username": username,
                "password": password
            });
        },
        
        request_logOut() {
            socket.emit('logOut');
        },

        request_groupsFeed(oldestTimestamp = 0) {
            if(oldestTimestamp) {
                socket.emit('groupsFeed');
            } else {
                socket.emit('groupsFeed', {
                    "oldestTimestamp": oldestTimestamp
                });
            }
        },

        request_invitationsFeed(oldestTimestamp = 0) {
            if(oldestTimestamp) {
                socket.emit('invitationsFeed');
            } else {
                socket.emit('invitationsFeed', {
                    "oldestTimestamp": oldestTimestamp
                });
            }
        },

        request_discoverGroups(oldestTimestamp = 0) {
            if(oldestTimestamp) {
                socket.emit('discoverGroups');
            } else {
                socket.emit('discoverGroups', {
                    "oldestTimestamp": oldestTimestamp
                });
            }
        },

        request_messages(start) {
            socket.emit('messages');
        },

        request_chat(chatID) {
            socket.emit('chat', {
                "chatID": chatID
            });
        },

        request_discoverGroupsSearch(search, oldestTimestamp = 0) {
            if(oldestTimestamp) {
                socket.emit('discoverGroupsSearch', {
                    "search": search
                });
            } else {
                socket.emit('discoverGroupsSearch', {
                    "search": search,
                    "oldestTimestamp": oldestTimestamp
                });
            }
        },

        request_discoverGroupsJoin(groupID) {
            socket.emit('discoverGroupsJoin', {
                "chatID": groupID
            });
        },

        request_createGroupCheck(name) {
            socket.emit('createGroupCheck', {
                "name": name
            });
        },

        request_createGroup(name, isPublic, requestToJoin) {
            socket.emit('createGroup', {
                "name": name,
                "isPublic": isPublic,
                "requestToJoin": requestToJoin
            });
        },

        request_register(username, password) {
            socket.emit('register', {
                "username": username,
                "password": password
            });
        },
        
        request_enterChat(id) {
            socket.emit('chat', {
                "chatID": id
            });
        },
        
        request_messages(start = 0, limit = 100) {
            socket.emit('messages', {
                "start": start,
                "limit": limit
            });
        },
        
        request_message(content_type, content) {
            socket.emit('message', {
                "content_type": content_type,
                "content": content
            });
        },


        // ### SERVER RESPONSES ###

        response_loggedIn(data) {
            if("nickname" in data && "userID" in data) {
                this.username = data["nickname"];
                this.userID = data["userID"];
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
                        if(group["timestamp"] < this.groupsOldestTimestamp) {

                            // If this group is the oldest one, add it to the end
                            this.groups.push(group);
                            this.groupsOldestTimestamp = group["timestamp"];
                        } else if(group["timestamp"] > this.groupsNewestTimestamp) {

                            // If this group is the newest one, add it to the beginning
                            this.groups.unshift(group);
                            this.groupsNewestTimestamp = group["timestamp"];
                        } else {

                            // If this group is somewhere between, find the right spot
                            let numgroups = this.groups.length;
                            for(let i = 0; i < numgroups; i++) {
                                if(group["timestamp"] < this.groups[i]["timestamp"]) {
                                    this.groups.splice(i, 0, group);
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
                        if(discoverGroupsResult["timestamp"] < this.discoverGroupsResultsOldestTimestamp) {

                            // If this discoverGroupsResult is the oldest one, add it to the end
                            this.discoverGroupsResults.push(discoverGroupsResult);
                            this.discoverGroupsResultsOldestTimestamp = discoverGroupsResult["timestamp"];
                        } else if(discoverGroupsResult["timestamp"] > discoverGroupsResultsNewestTimestamp) {

                            // If this discoverGroupsResult is the newest one, add it to the beginning
                            this.discoverGroupsResults.unshift(discoverGroupsResult);
                            this.discoverGroupsResultsNewestTimestamp = discoverGroupsResult["timestamp"];
                        } else {

                            // If this discoverGroupsResult is somewhere between, find the right spot
                            let numdiscoverGroupsResults = this.discoverGroupsResults.length;
                            for(let i = 0; i < this.numdiscoverGroupsResults; i++) {
                                if(discoverGroupsResult["timestamp"] < this.discoverGroupsResults[i]["timestamp"]) {
                                    this.discoverGroupsResults.splice(i, 0, discoverGroupsResult);
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

        response_messages(data) {
            console.log("messages received");
            if(data["append"] == true) {
                data["messages"].forEach(message => {
                    if("timestamp" in message) {
                        if(message["timestamp"] < this.messagesOldestTimestamp) {

                            // If this message is the oldest one, add it to the end
                            this.messages.push(message);
                            this.messagesOldestTimestamp = message["timestamp"];
                        } else if(message["timestamp"] > this.messagesNewestTimestamp) {

                            // If this message is the newest one, add it to the beginning
                            this.messages.unshift(message);
                            this.messagesNewestTimestamp = message["timestamp"];
                        } else {

                            // If this message is somewhere between, find the right spot
                            let nummessages = this.messages.length;
                            for(let i = 0; i < nummessages; i++) {
                                if(message["timestamp"] < this.messages[i]["timestamp"]) {
                                    this.messages.splice(i, 0, message);
                                    break;
                                }
                            }
                        }
                    }
                });
            } else if(data["append"] == false) {
                this.messages = data["messages"];
                this.messages.sort((messageA, messageB) => {
                    messageA["timestamp"] - messageB["timestamp"];
                });
                this.messages.forEach(message => {
                    this.messagesOldestTimestamp = Math.min(
                        this.messagesOldestTimestamp,
                        message["timestamp"]
                    );
                    this.messagesNewestTimestamp = Math.max(
                        this.messagesNewestTimestamp,
                        message["timestamp"]
                    );
                });
            }
        },

        response_discoverGroupsJoin(data) {
            if("chatID" in data) {
                this.discoverGroupsResults.some((g, i, arr) => {
                    if(g["id"] == data["chatID"]) {
                        arr[i]["isMember"] = true;
                        return true;
                    }
                })
            }
        },

        response_createGroupCheck(data) {
            if("isTaken" in data) {
                this.createGroupIsNameTaken = data["isTaken"];
            }
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
        },
        
        response_enterChat(data) {
            if("leave" in data && data["leave"] == true) {
                this.showChat = false;
                this.showChatID = 0;
                this.showChatName = '';
                this.messages = [];
            } else {
                if(!("chatID" in data) || !("name" in data)) return;
                
                this.showChat = true;
                this.showChatID = data["chatID"];
                this.showChatName = data["name"];
                this.messages = [];
                
                this.request_messages(0);
            }
        }
    },

    mounted() {
        socket.on('loggedIn', (data) => {
            this.response_loggedIn(data);
        });
        socket.on('loggedOut', (data) => {
            this.response_loggedOut(data);
        });
        socket.on('invitationsFeed', (data) => {
            this.response_invitationsFeed(data);
        });
        socket.on('groupsFeed', (data) => {
            this.response_groupsFeed(data);
        });
        socket.on('discoverGroupsResultsFeed', (data) => {
            this.response_discoverGroupsResultsFeed(data);
        });
        socket.on('discoverGroupsJoin', (data) => {
            this.response_discoverGroupsJoin(data);
        });
        socket.on('messages', (data) => {
            this.response_messages(data);
        });
        socket.on('createGroupCheck', (data) => {
            this.response_createGroupCheck(data);
        });
        socket.on('createGroup', (data) => {
            this.response_createGroup(data);
        });
        socket.on('register', (data) => {
            this.response_register(data);
        });
        socket.on('chat', (data) => {
            this.response_enterChat(data);
        });
        
        appInside = this;
    }
});




app.mount("#app");