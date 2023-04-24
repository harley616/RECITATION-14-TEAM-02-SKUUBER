DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password CHAR(60) NOT NULL
);
DROP TABLE IF EXISTS user_friends;
CREATE TABLE user_friends (
    username VARCHAR(50) NOT NULL,
    friend_username VARCHAR(50) NOT NULL,
    PRIMARY KEY (username, friend_username),
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE,
    FOREIGN KEY (friend_username) REFERENCES users(username) ON DELETE CASCADE
);
DROP TABLE IF EXISTS friend_add_queue;
CREATE TABLE friend_add_queue (
    username VARCHAR(50) NOT NULL,
    friend_username VARCHAR(50) NOT NULL,
    PRIMARY KEY (username, friend_username),
    FOREIGN KEY (username) REFERENCES users(username),
    FOREIGN KEY (friend_username) REFERENCES users(username)
);