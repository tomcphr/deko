class World {
    constructor (map) {
        this.sessions = {};

        this.items = {};

        this.map = map;
    };

    tick () {
        var self = this;

        var paths = new (require("./Paths"))(this);

        var update = () =>  {
            var packet = {
                "players"   :   {}
            };

            for (var s in self.sessions) {
                var session = self.sessions[s];
                if (!session.user) {
                    continue;
                }

                var user = self.updateUser(session);

                // Ensure that we only try to follow when the player has completed a full tile.
                var following = user.following;
                if (user.walking) {
                    following = "";
                }

                packet.players[user.id] = {
                    "loaded"            :   user.loaded,
                    "id"                :   user.id,
                    "health"            :   user.health,
                    "maxHealth"         :   user.maxHealth,
                    "avatar"            :   user.avatar,
                    "facing"            :   user.facing,
                    "frame"             :   Math.ceil(user.frame),
                    "x"                 :   user.x,
                    "y"                 :   user.y,
                    "following"         :   following,
                    "message"           :   {
                        "id"                :   user.message.id,
                        "text"              :   user.message.text,
                    }
                };
            }

            packet["items"] = self.getDroppedItems();

            packet["worldMap"] = self.getTileMap();
            packet["worldMatrix"] = paths.getTileMatrix();

            // Send the details of the world to every session
            for (var s in self.sessions) {
                var session = self.sessions[s];
                if (session.user) {
                    packet["logged"] = session.user.id;
                }

                session.getSocket().emit("gameTick", packet);
            };
        };
        let interval = setInterval(update, 1000 / 30);

        return interval;
    };

    getTileMap () {
        return this.map;
    };

    updateUser (session) {
        var user = session.user;
        if (!user.loaded) {
            return user;
        }

        user.position();

        user.animation();
        if (user.health <= 0) {
            user.die();
        }

        if (user.attacking.user) {
            let session = this.getUserSession(user.attacking.user);
            if (session) {
                let victim = session.user;

                var hitmarkers = {
                    "above" :   {
                        "x"     :   victim.x,
                        "y"     :   victim.y - 32,
                    },
                    "below" :   {
                        "x"     :   victim.x,
                        "y"     :   victim.y + 32,
                    },
                    "left"  :   {
                        "x"     :   victim.x - 32,
                        "y"     :   victim.y,
                    },
                    "right" :   {
                        "x"     :   victim.x + 32,
                        "y"     :   victim.y,
                    },
                };
                let inRange = false;
                for (var type in hitmarkers) {
                    var hitmarker = hitmarkers[type];
                    if (hitmarker.x === user.x && hitmarker.y === user.y) {
                        inRange = true;
                        break;
                    }
                }

                // If we are within one block of the user; attack.
                if (inRange) {
                    if (!user.attacking.timeout) {
                        user.attacking.timeout = setTimeout(()  =>  {
                            victim.damage(10);

                            clearTimeout(user.attacking.timeout);

                            user.attacking.timeout = null;

                            // If we have just caused the player to die; don't beat a dead horse.
                            if (victim.health <= 0) {
                                user.reset();
                            }
                        }, 1000);
                    }
                }
            }
        }

        // Check if the player is touching any dropped items
        for (var i in this.items) {
            var item = this.items[i];

            let touchingItem = this.collision(user, item);
            if (touchingItem) {
                this.removeDrop(i, ()   =>  {
                    user.pickup(item.id, item.quantity);
                });
            }
        }

        return user;
    };

    getUsersAtXY (x, y) {
        let users = [];
        for (var session in this.sessions) {
            var session = this.sessions[session];

            var user = session.user;
            if (!user) {
                continue;
            }

            if (user.x == x && user.y == y) {
                users.push(user);
            }
        }
        return users;
    };

    getDroppedItems () {
        var items = [];
        for (var i in this.items) {
            var item = this.items[i];

            item.key = i;

            items.push(item);
        }
        return items;
    };

    getUserSession (username) {
        for (var session in this.sessions) {
            var session = this.sessions[session];

            var user = session.user;
            if (!user) {
                continue;
            }

            if (user.id === username) {
                return session;
            }
        }

        return false;
    };

    addSession (session, user) {
        var id = session.id;

        session["user"] = user;

        this.sessions[id] = session;
    };

    removeSession (session) {
        var id = session.id;

        delete this.sessions[id];
    };

    addDrop (item, name, quantity, x, y) {
        var self = this;

        // Use setTimeout to ensure we get a unique item drop identifier
        setTimeout(()   =>  {
            var key = "drop_" + item + "_" + quantity + "_" + Math.round((new Date()).getTime() / 1000);

            self.items[key] = {
                "id"        :   item,
                "name"      :   name,
                "quantity"  :   quantity,
                "x"         :   x,
                "y"         :   y,
                "width"     :   32,
                "height"    :   32,
            };
        }, 250);
    };

    removeDrop (dropKey, callback) {
        var items = this.items;
        if (!items.hasOwnProperty(dropKey)) {
            return;
        }

        if (callback) {
            callback();
        }

        delete this.items[dropKey];
    };

    collision (object1, object2) {
        var xMatch = object1.x < object2.x + object2.width  && object1.x + object1.width  > object2.x;
        var yMatch = object1.y < object2.y + object2.height && object1.y + object1.height > object2.y;
        if (xMatch && yMatch) {
            return true;
        }

        return false;
    };

    teleport (fromSession, toSession) {
        var fromUser = fromSession.user;
        var toUser = toSession.user;

        if (!fromUser || !toUser) {
            return;
        }

        fromUser.x = toUser.x;
        fromUser.y = toUser.y;

        this.addSession(fromSession);
    };

    kill (username) {
        var session = this.getUserSession(username);
        if (session.user) {
            session.user.die();
            return true;
        }

        return false;
    };

    logout (session, callback, reason = "") {
        if (!session.user) {
            return;
        }

        var user = session.user;
        if (callback) {
            user.save(callback);
        } else {
            user.save();
        }

        session.user = null;

        if (reason) {
            session.getSocket().emit("logout", reason);
        }
    }

    disconnect (session) {
        var id = session.id;
        if (!(id in this.sessions)) {
            return;
        }

        var self = this;
        if (!("user" in this.sessions[id])) {
            self.removeSession(session);
            return;
        }

        this.logout(session, () =>  {
            self.removeSession(session);
        });
    };
}
module.exports = World;
