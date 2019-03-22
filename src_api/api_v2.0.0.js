(function () {
    "use strict";

    const permission = require("../src_auth/acceptedUsers.js").permission;
    const MongoClient = require('mongodb').MongoClient;
    const ObjectID = require('mongodb').ObjectID;
    const database_core = 'mongodb://localhost:27017/';
    const ID = "_id";
    const SET = "$set";

    let lib = {}, findToArray, caller, list, get, put, post, checkPerm, connect;

    connect = (function () {
        let oneConnection, connections = {};
        oneConnection = function (database_name) {
            return new Promise(function (resolve, reject) {
                MongoClient.connect(database_core + database_name, function (err, db) {
                    if (err) {
                        reject(new Error('500: could not connect to database: ' + err));
                    } else {
                        resolve(db);
                    }
                });
            });
        };
        return function (database) {
            connections[database] = connections[database] || oneConnection(database);

            //if it failed, try a second time, just in case there was a server
                // error
            connections[database] = (function (database_name) {
                return connections[database_name].catch(function () {
                    return oneConnection(database_name);
                });
            }(database));

            return connections[database];
        };
    }());

    checkPerm = function (request, type) {
        let perms;
        //returns a promise which results in a permission object
        //request.params.collection
        //request.params.database

        // permission should be passed an api key if there is one, or will grab
                // the one that is in cookies if not.

        if (request.query && request.query.api_key) {
            perms = permission(request, request.query.api_key);
        } else {
            perms = permission(request);
        }
        return perms.then(function (perm_obj) {
            let i, j, ret = false;
            // look for database
            for (i = 0; i < perm_obj.permissions.length && !ret; i += 1) {
                //Correct database?
                if (perm_obj.permissions[i].database.toLowerCase() === request.params.database.toLowerCase()) {
                    //Look at collections
                    for (j = 0; j < perm_obj.permissions[i].collections.length && !ret; j += 1) {
                        //Correct collection?
                        if (perm_obj.permissions[i].collections[j].name.toLowerCase() === request.params.collection.toLowerCase()) {
                            // permission to read/write?
                            if (perm_obj.permissions[i].collections[j][type]) {
                                ret = perm_obj[ID];
                            }
                        }
                    }
                }
            }
            return ret;
        }).catch(function () {
            throw new Error('500: Check for authentication failed.');
        }).then(function (allowed) {
            if (allowed) {
                // return a function for updating active keys object
                return (function (id_str) {
                    return function (update_obj) {
                        return connect('users').then(function (db) {
                            let findObj = {};
                            findObj[ID] = new ObjectID(id_str);
                            return new Promise(function (resolve, reject) {
                                db.collection('active_keys').updateOne(findObj, update_obj, {}, function (err, res) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(res);
                                    }
                                });
                            });
                        });
                    };
                }(allowed));
            }
            throw new Error('401: User is not authenticated for that action.');
        });
    };

    findToArray = function (db, collection, search, limit) {
        search = search || {};
        limit = limit || {};
        return new Promise(function (resolve, reject) {
            db.collection(collection).find(search, limit).toArray(function (err, qRes) {
                if (err) {
                    reject(new Error('500: Server failed to connect to collection: ' + err));
                } else {
                    resolve(qRes);
                }
            });
        });
    };

    list = (function () {
        //scoped to declare default lists for each database
        let collection_default_find = {};
        collection_default_find[ID] = 1;

        return function (request) {
            return checkPerm(request, 'read').then(function () {
                // If I am here, I am authenticated, otherwise
                   // an error will have been thrown.
                // connect to the database
                return connect(request.params.database);
            }).then(function (db) {
                // Actually do the search
                if (request.query.all && request.query.all.toLowerCase() === "true") {
                    return findToArray(db, request.params.collection, {});
                }
                return findToArray(db, request.params.collection, {}, collection_default_find);
            }).then(function (arr) {
                return {
                    data: arr,
                    message: "Successfully connected and queried database",
                    links: {self: 'http://' + request.headers.host + request.url}
                };
            });
        };
    }());

    get = function (request) {
        return checkPerm(request, 'read').then(function () {
            // If I am here, I am authenticated, otherwise
               // an error will have been thrown.
            // connect to the database
            return connect(request.params.database);
        }).then(function (db) {
            // Actually do the search
            let search = {};
            if (request.params.database.toLowerCase() === 'kinome') {
                search[ID] = request.params.doc_id;
            } else {
                search[ID] = new ObjectID(request.params.doc_id);
            }

            return findToArray(db, request.params.collection, search);
        }).then(function (arr) {
            return {
                data: arr,
                message: "Successfully connected and queried database",
                links: {self: 'http://' + request.headers.host + request.url}
            };
        });
    };

    put = function (request) {
        // this is to edit an old object
        return checkPerm(request, 'write').then(function (store_changes) {
            // If I am here, I am authenticated, otherwise
               // an error will have been thrown.
            // connect to the database
            return connect(request.params.database);
        }).then(function (db) {
            // insert the object
            return new Promise(function (resolve, reject) {
                let searchObj = {}, obj_id, edit_body = {};
                edit_body[SET] = request.body;

                //verify doc id
                if (request.params.database.toLowerCase() === "kinome") {
                    if (request.params.doc_id.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)) {
                        obj_id = request.params.doc_id;
                    } else {
                        reject("403: Improperly formed id for database entry.");
                    }
                } else {
                    obj_id = new ObjectID(request.params.doc_id);
                }

                //verify header type
                if (request.headers["content-type"].toLowerCase() !== "application/json") {
                    reject(new Error("403: Only JSON type is accepted."));
                } else {

                    //verified issues, actually update
                    searchObj[ID] = obj_id;
                    db.collection(request.params.collection).updateOne(searchObj, edit_body, {upsert: false}, function (err, data) {
                        if (err) {
                            reject(new Error('500: Failed to add a new key.\n' + err.message));
                        } else {
                            resolve({success: true, data: [data], message: "Successfully posted object", links: {self: 'http://' + request.headers.host + request.url}});
                        }
                    });
                }
            });
        });
    };

    post = function (request) {
        // this is to add a new object
        return checkPerm(request, 'write').then(function () {
            // If I am here, I am authenticated, otherwise
               // an error will have been thrown.
            // connect to the database
            return connect(request.params.database);
        }).then(function (db) {
            // insert the object
            return new Promise(function (resolve, reject) {
                if (request.headers["content-type"].toLowerCase() !== "application/json") {
                    reject(new Error("403: Only JSON type is accepted."));
                } else {
                    db.collection(request.params.collection).insertOne(request.body, function (err, data) {
                        if (err) {
                            reject(new Error('500: Failed to add a new key.\n' + err.message));
                        } else {
                            resolve({success: true, data: [data], message: "Successfully posted object", links: {self: 'http://' + request.headers.host + request.url}});
                        }
                    });
                }
            });
        });
    };

    caller = function (func) {
        return function (request, response, next) {
            return func(request).then(function (res) {
                response.send(res);
                return next();
            }).catch(function (err) {
                //default error message
                let code = "500";
                console.error(err);
                if (err.message.match(/^(\d{3}):/)) {
                    code = err.message.replace(/^(\d{3}):[\s\S]+/, "$1");
                }

                //send it back with the code and the object
                response.send(code * 1, {
                    error: {
                        code: code,
                        message: err.message
                    }
                });
                return next();
            });
        };
    };

    lib = {
        list: caller(list),
        get: caller(get),
        put: caller(put),
        post: caller(post)
    };

    module.exports = lib;

    return false;
}());