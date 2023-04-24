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

DROP TABLE IF EXISTS events;
CREATE TABLE events (
    event_id serial primary key,
    owner VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    title VARCHAR(50) NOT NULL,
    location VARCHAR(50) NOT NULL,
);

DROP TABLE IF EXISTS users_to_events;
create table users_to_events(
    username VARCHAR(50) NOT NULL, 
    event_id smallint
);
