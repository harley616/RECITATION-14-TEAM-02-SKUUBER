
// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************


const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords




// *****************************************************
// <!-- Section 2 : Classes -->
// *****************************************************

function Event(event_id, owner, name, date, location) {
  this.event_id = event_id;
  this.owner = owner;
  this.name = name;
  this.date = date; // Date() object, this also has the time (use getTime())
  this.location = location;
}

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************


// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};


const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.


// initialize session variables

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,

  })
);



app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(express.static("public"));


// TODO - Include your API routes here

app.get('/', (req, res) => {
  res.render('pages/login')
});

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});




//--------------------------------------------- R E G I S T E R ---------------------------------------------------------//

// WANT: 
// list of 7
// list of events for each day
// in each event: title, location, owner, event_id, 
// padding amount.
const processData = (events) => {
  const calendarList = [];
  for (let i = 0; i < 7; i++) {
    calendarList.push([]);
  }
  const currentDate = Date.now();
  for (let i = 0; i < 7; i++) {
    const futureDate = currentDate + (i * 24 * 60 * 60 * 1000);
    const day = new Date(futureDate).getDay();
    console.log('filtering events');
    console.log(events);
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getDay() === day;
    }
    )
    const mappedDayEvents = dayEvents.map(event => {
      const obj = new Object()
      obj.title = event.title;
      obj.location = event.location;
      obj.owner = event.owner;
      obj.event_id = event.event_id;
      // get time in hours (0-24)
      // the padding is (3.125vh * hours) + 8vh
      // this is where on the calendar the event shows up
      const hours = new Date(event.date).getHours();
      obj.hours = hours;
      obj.padding = (3.23 * hours + 7).toFixed(2) + 'vh';
      return obj;
    })
    calendarList[i] = mappedDayEvents;
  }

  return calendarList;

}
const TIMES = [
  '02 AM',
  '03 AM',
  '04 AM',
  '05 AM',
  '06 AM',
  '07 AM',
  '08 AM',
  '09 AM',
  '10 AM',
  '11 AM',
  '12 PM',
  '01 PM',
  '02 PM',
  '03 PM',
  '04 PM',
  '05 PM',
  '06 PM',
  '07 PM',
  '08 PM',
  '09 PM',
  '10 PM',
  '11 PM',
  '12 AM',
  '01 AM'
]
app.get('/calendar', async (req, res) => {
  const owner = req.session.user[0]['username'];
  const get_events_query = `select * from events where owner = $1`;
  var values = [owner];
  const get_event_result = await db.any(get_events_query, values);
  console.log('successfully got events for user: ' + owner);

  //******* friend stuff *******/

  // add any events that you are shared with
  const get_shared_events_query = `select * from users_to_events where username = $1`;
  var values = [owner];
  const get_shared_event_result = await db.any(get_shared_events_query, values);
  // list of event_id
  const shared_event_ids = get_shared_event_result.map(event => event.event_id);
  console.log('shared_event_ids: ', shared_event_ids);
  // get all the events with those event_ids, as long as event.owner != owner
  const get_shared_events_query2 = `select * from events where event_id = ANY($1)`;
  var values = [shared_event_ids];
  const get_shared_event_result2 = await db.any(get_shared_events_query2, values);
  console.log('successfully got shared events for user: ' + owner);
  const shared_events = get_shared_event_result2;
  console.log('shared_events: ', shared_events);

  // filter shared events, only keep the ones that are not owned by owner
  const filtered_shared_events = shared_events.filter(event => event.owner != owner);
  console.log('filtered_shared_events: ', filtered_shared_events)
  console.log('event result: ', get_event_result)
  const full_events = [].concat(get_event_result, filtered_shared_events);
  console.log('full_events: ', full_events)
  const processed_full_events = processData(full_events);

  res.render('pages/calendar', { calendarData: processed_full_events, times: TIMES });
})

//WORKS dont fuck with it
app.get('/friend_calendar', async (req, res) => {
  // get list of your friends
  const owner = req.session.user[0]['username'];
  const get_friends_query = `select * from user_friends where username = $1`;
  var values = [owner];
  const get_friends_result = await db.any(get_friends_query, values);
  console.log('successfully got friends for user: ' + owner);
  const friends = get_friends_result;
  const friend_usernames = friends.map(friend => friend.friend_username);
  console.log('friend_usernames: ', friend_usernames);

  // get events for each friend
  const friendEvents = [];
  const get_friend_events_query = `select * from events where owner = $1`;
  for (let i = 0; i < friend_usernames.length; i++) {
    const friend_username = friend_usernames[i];
    var values = [friend_username];
    const get_friend_events_result = await db.any(get_friend_events_query, values);
    console.log('successfully got events for user: ' + friend_username);
    const friend_events = get_friend_events_result[0];
    for (let j = 1; j < get_friend_events_result.length; j++) {
      friendEvents.push(get_friend_events_result[j]);
    }
  }
  const processed_calendar_data = processData(friendEvents);
  res.render('pages/friend_calendar', { calendarData: processed_calendar_data, times: TIMES });
})


app.get('/register', (req, res) => {
  res.render('pages/register')
});


// Register
app.post('/register', async (req, res) => {
  console.log('username: ', req.body.username);
  console.log('password: ', req.body.password);
  const username = req.body.username;
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);
  // To-DO: Insert username and hashed password into 'users' table
  try {

    //Check to see whether or not the username is already taken within the user table
    const checker = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    //If username is not taken (i.e. check.length === 0):
    if (checker.length === 0) {
      const insertion = await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);
      console.log('hash: ', hash);
      await res.redirect('/login');
    } else {

      //If username is already taken (i.e. check.length != 0)
      console.log('username already exists');
      await res.redirect('/register');
    }
  } catch (error) {

    //General catch-all for errors
    console.error(error);
    await res.redirect('/register');
  }

});

//--------------------------------------------- L O G I N ---------------------------------------------------------//

app.get('/login', (req, res) => {
  res.render('pages/login')
});

// Login
app.post('/login', async (req, res) => {
  console.log('username: ', req.body.username);
  console.log('password: ', req.body.password);
  //console.log('hashed password: ',  await bcrypt.hash(req.body.password, 10));
  const username = req.body.username;
  try {
    const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);  //Checking if username exists in the table
    if (user.length === 0) {                                                                        //if username does not exist: 
      console.log('Username not found.');
      await res.redirect('/register');                                                  //redirect to registration page
    } else {                                                                                      //if username does exist:
      console.log('Username found. Matching passwords...');
      console.log('Inputted password: ', req.body.password);
      console.log('Stored password: ', user[0].password);
      const match = await bcrypt.compare(req.body.password, user[0].password);                           //checking is password matches the user's stored password
      console.log('Match Value: ', match);
      if (match === true) {                                                                                  //if the passwords match
        console.log('Username and password match. Setting user.');
        req.session.user = user;                                                                            //set user, redirect to discover
        req.session.save();
        await res.redirect('/home');
      } else {                                                                                          //if passwords do not match
        //console.error(error);                                                                               //throw error, incorrect username/password
        console.log('Incorrect username or password.');
        await res.redirect('/login');
      }
    }

  } catch (error) {
    //General catch-all for errors
    console.error(error);
    await res.redirect('/login');
  }
});

app.post("/addFriendRequest", (req, res) => {
  const query = "INSERT INTO friend_add_queue (username, friend_username) VALUES ($1, $2)";
  const values = [req.session.user[0]['username'], req.body.friend_username];
  db.any(query, values)
    .then(function () {
      console.log("Successfully added friend request!");
      console.log('from ' + req.session.user[0]['username'])
      console.log('friend request to ' + req.body.friend_username);
      console.log(req.body)
      console.log(values)
      res.redirect("/home");
    })
    .catch(function (err) {
      console.log(err);
      res.redirect("/home");
    });
});

app.get("/acceptFriend", (req, res) => {
  console.log('accepting friend : ' + req.query.username + ' as ' + req.session.user[0]['username'])
  const friend_username = req.session.user[0]['username'];
  const username = req.query.username
  console.log('deleting add_friend_queue')
  // because this is from the perspective of the other person, we swap $2 and $1
  const query = "DELETE FROM friend_add_queue WHERE username = $1 AND friend_username = $2;";
  const values = [username, friend_username];
  db.any(query, values)
    .then(function () {
      console.log('successfully deleted.')
      console.log('adding relationship into user_friends.')
      const query1 = "INSERT INTO user_friends (username, friend_username) VALUES ($1, $2)";
      const query2 = "INSERT INTO user_friends (username, friend_username) VALUES ($2, $1)";
      //const values = [req.session.user[0]['username'], req.query.friend_username];
      db.task('get-everything', task => {
        return task.batch([task.any(query1, values), task.any(query2, values)]);
      })
        .then(function () {
          console.log("Successfully added friend: friend " + values[1] + " for " + values[0]);
          res.redirect("/home");
        })
        .catch(function (err) {
          console.log(err);
          res.redirect("/home");
        });
    })
    .catch(function (err) {
      console.log(err);
      res.redirect("/home");
    });
});
app.delete("/declineFriendRequest", (req, res) => {
  const query = "DELETE FROM friend_add_queue WHERE username = $1 AND friend_username = $2;";
  const values = [req.session.user, req.body.friend_username];
  db.any(query, values)
    .then(function () {
      console.log("Successfully deleted friend request from queue!");
      res.redirect("/home");
    })
    .catch(function (err) {
      console.log(err);
      res.sendStatus(500);
    });
});
app.get('/friendList', function (req, res) {
  // Fetch query parameters from the request object
  var username = req.session.user;
  // Multiple queries using templated strings
  var friend_request = `select * from user_friends where username=$1`;
  // use task to execute multiple queries
  db.task('get-everything', task => {
    return task.batch([task.any(friend_request, [username])]);
  })
    // if query execution succeeds
    // query results can be obtained
    // as shown below
    .then(data => {
      res.status(200).json({
        Friends: data[0],

      });
    })
    // if query execution fails
    // send error message
    .catch(err => {
      console.log('Uh Oh spaghettio');
      console.log(err);
      res.status('400').json({
        current_user: '',
        city_users: '',
        error: err,
      });
    });
});


app.get('/friendRequestList', function (req, res) {

  // Fetch query parameters from the request object
  var username = req.session.user[0]['username'];

  console.log('friend request list')
  console.log(username)
  // Multiple queries using templated strings
  var friend_add_queue = `select * from friend_add_queue`;

  console.log(friend_add_queue)
  // use task to execute multiple queries
  db.any(friend_add_queue)
    // if query execution succeeds
    // query results can be obtained
    // as shown below
    .then(data => {

      console.log("the friend request list for")
      console.log(username)
      console.log(data)
      res.status(200).json({
        FriendReq: data[0],
      });
    })
    // if query execution fails
    // send error message
    .catch(err => {
      console.log('Uh Oh spaghettio');
      console.log(err);
      res.status('400').json({
        current_user: '',
        city_users: '',
        error: err,
      });
    });
});

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

app.get('/home', async (req, res) => {
  // Fetch query parameters from the request object
  var username = req.session.user[0]['username'];
  // Multiple queries using templated strings
  var friend_add_queue = `select * from friend_add_queue where friend_username = $1`;
  // use task to execute multiple queries
  const friend_req_data = await db.any(friend_add_queue, username)
  console.log("the friend request list for: " + username)
  console.log(friend_req_data)

  var friend_list_query = `select * from user_friends where username = $1`;
  const friend_data = await db.any(friend_list_query, username)
  console.log("the friend list for: " + username)
  console.log(friend_data)
  res.render('pages/home', {
    user: req.session.user[0]['username'],
    friend_request_list: friend_req_data,
    friend_list: friend_data
  })
});

app.get('/friendTest', (req, res) => {
  console.log('user')
  console.log(req.session.user)

});
const calendar = require("./views/pages/calendarconfig");

app.get("/MyCalendar", (req, res) => {
  const year = 2023;
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  res.render("pages/MyCalendar", { calendar: calendar(year), months, year });
});
// add an event for a user
// must have a NAME, TIME (in hours, 0-24), LOCATION (Boulder, CO)
app.post('/addEvent', async (req, res) => {
  const username = req.session.user[0]['username'];
  const title = req.body.title;
  const date = req.body.date;
  const time = req.body.time;
  const location = req.body.location;
  const full_date = date + 'T' + time;

  // add the event to events table
  const add_event_query = "INSERT INTO events (owner, date, title, location) VALUES ($1, $2, $3, $4)";
  var values = [username, full_date, title, location];
  const add_event_result = await db.any(add_event_query, values);

  // get the id of the event
  const event_id_query = "SELECT event_id FROM events WHERE owner = $1 AND date = $2 AND title = $3 AND location = $4";
  var values = [username, full_date, title, location];
  const event_id_result = await db.any(event_id_query, values);

  console.log('event id result')
  const event_id = event_id_result[0]['event_id'];
  console.log(event_id)

  const u2e_query = "INSERT INTO users_to_events (username, event_id) VALUES ($1, $2)";
  var values = [username, event_id];
  const u2e_result = await db.any(u2e_query, values);
  res.redirect('/calendar');
})

// get list of events for a user
// Event{date: '2020-04-20T08:00', event_id: 1, owner: 'a', title: 'test', location: 'Boulder, CO'}

app.get('/getFriendEvents', async (req, res) => {
  const owner = req.query.friend_username; //username of the person whose events to get
  const get_events_query = `select * from events where owner = $1`;
  var values = [friend_username];
  const get_event_result = await db.any(get_events_query, values);
  console.log('successfully got events for user: ' + req.session.user[0]['username']);
  return res.status(200).json(get_event_result);
})

app.post('/addSelfToFriendEvent', async (req, res) => {
  const username = req.session.user[0]['username'];
  const event_id = req.body.event_id; // req.query.event_id id of the event to add self to 
  const set_users_to_events = `insert INTO users_to_events (username, event_id) VALUES ($1, $2)`;
  var values = [username, event_id];
  const get_event_result = await db.any(set_users_to_events, values);
  console.log('successfully added: ' + username + " to event id: " + event_id);
  console.log(get_event_result);
  return res.redirect('/calendar');
})

app.get('/getAddedEvents', async (req, res) => {
  // get all event_id from users_to_events where youre the user
  const username = req.session.user[0]['username'];
  const u2e_query = `select * from users_to_events where username = $1`;
  var values = [username];
  const u2e_result = await db.any(u2e_query, values);
  //get a list of the event ids
  const mapped_u2e_result = u2e_result.map((u2e) => u2e['event_id']);
  // list of Event object
  const full_events_list = [];
  for (let i = 0; i < mapped_u2e_result.length; i++) {
    const current_event_id = mapped_u2e_result[i];
    const get_event_query = `select * from events where event_id = $1`;
    var values = [current_event_id];
    const get_event_result = await db.any(get_event_query, values);
    full_events_list.push(get_event_result[0]);
  }
  return res.status(200).json(full_events_list)
})

// get the events for a user
app.get('/getEvents', async (req, res) => {
  const owner = req.session.user[0]['username'];
  const get_events_query = `select * from events where owner = $1`;
  var values = [owner];
  const get_event_result = await db.any(get_events_query, values);
  console.log('successfully got events for user: ' + owner);
  return res.status(200).json(get_event_result);
})


//same as acceptFriend, except we don't add the relationship into user_friends
app.get("/declineFriend", async (req, res) => {
  console.log('accepting friend : ' + req.query.username + ' as ' + req.session.user[0]['username'])
  const friend_username = req.session.user[0]['username'];
  const username = req.query.username
  console.log('deleting add_friend_queue')
  // because this is from the perspective of the other person, we swap $2 and $1
  const query = "DELETE FROM friend_add_queue WHERE username = $1 AND friend_username = $2;";
  const values = [username, friend_username];
  const query_result = await db.any(query, values);
  console.log('successfully deleted.')
  console.log(query_result);
  res.redirect("/home");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("pages/login");
});


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');