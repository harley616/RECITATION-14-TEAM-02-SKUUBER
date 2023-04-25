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

function Event(owner, name, date, time, location) {
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
/*
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,

  })
);
*/

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// TODO - Include your API routes here

app.get('/', (req, res) => {
  res.render('pages/login')
});

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.post('/addEvent', async (req, res) => {
    const username = 'a';
    const title = 'New Event';
    const date = "2023-4-24"
    const time = '14:48:00';
    const location = 'Boulder, Colorado';
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
    res.status(200).json({status: 'success', message: 'Event added.', u2e_result: u2e_result});


})


//--------------------------------------------- R E G I S T E R ---------------------------------------------------------//

app.get('/register', (req, res) => {
  res.render('pages/register')
});

// Register
app.post('/register', async (req, res) => {
  console.log('username: ', req.body.username);
  console.log('password: ', req.body.password);
  const username= req.body.username;
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);
  // To-DO: Insert username and hashed password into 'users' table
  try {

    //Check to see whether or not the username is already taken within the user table
    const checker = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    //If username is not taken (i.e. check.length === 0):
    if(checker.length === 0){
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
  const username= req.body.username;
  try {
  const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);  //Checking if username exists in the table
  if(user.length === 0){                                                                        //if username does not exist: 
    console.log('Username not found.');
    await res.redirect('/register');                                                  //redirect to registration page
  } else {                                                                                      //if username does exist:
    console.log('Username found. Matching passwords...');
    console.log('Inputted password: ', req.body.password);
    console.log('Stored password: ', user[0].password);
    const match = await bcrypt.compare(req.body.password, user[0].password);                           //checking is password matches the user's stored password
    console.log('Match Value: ', match);
    if(match === true){                                                                                  //if the passwords match
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
          return task.batch([task.any(query1,values), task.any(query2,values)]);
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
    res.render('pages/home', {user: req.session.user[0]['username'],
    friend_request_list: friend_req_data,
    friend_list: friend_data
    })
});

app.get('/friendTest', (req, res) => {
    console.log('user')
    console.log(req.session.user)

});

app.get('/calendar', async (req, res) => {
    const event = {
        'time': 8
    }

    var calendarData = [];
    for (let i = 0; i < 7; i++) {
        if (i == 3) {
            calendarData.push([event])
        }
        else {
            calendarData.push([])
        }
    }

    res.render('pages/calendar', calendarData)
  
})

// add an event for a user
// must have a NAME, TIME (in hours, 0-24), LOCATION (Boulder, CO)


app.get('/getEvents', async (req, res) => {
    const get_events_query = `select * from events where owner = $1`;
    var values  = [req.session.user[0]['username']];
    const get_event_result = await db.any(add_event_query, values);
    console.log('successfully got events for user: ' + req.session.user[0]['username']);
    return res.status(200).json(get_event_result);
})

app.get('/getFriendEvents', async (req, res) => {
    const friend_username = 'a'; // req.query.friend_username username of the person whose events to get
    const get_events_query = `select * from events where owner = $1`;
    var values  = [friend_username];
    const get_event_result = await db.any(get_events_query, values);
    console.log('successfully got events for user: ' + req.session.user[0]['username']);
    return res.status(200).json(get_event_result);
})

app.post('/addSelfToFriendEvent', async (req, res) => {
    const username = req.session.user[0]['username'];
    const event_id = req.query.event_id; // req.query.event_id id of the event to add self to 
    const set_users_to_events = `insert INTO events_to_users (username, event_id) VALUES ($1, $2)`;
    var values  = [username, event_id];
    const get_event_result = await db.any(set_users_to_events, values);
    console.log('successfully added: ' + username + " to event id: " + event_id);
    return res.redirect('/calendar');
})

app.get('/getAddedEvents', async (req, res) => {
    // get all event_id from users_to_events where youre the user
    const username = req.session.user[0]['username'];
    const u2e_query = `select * from users_to_events where username = $1`;
    var values  = [username];
    const u2e_result = await db.any(u2e_query, values);
    //get a list of the event ids
    const mapped_u2e_result = u2e_result.map((u2e) => u2e['event_id']);
    // list of Event object
    const full_events_list = [];
    for (let i = 0; i < mapped_u2e_result.length; i++) {
        const current_event_id = mapped_u2e_result[i];
        const get_event_query = `select * from events where event_id = $1`;
        var values  = [current_event_id];
        const get_event_result = await db.any(get_event_query, values);
        full_events_list.push(get_event_result[0]);
    }
    return res.status(200).json(full_events_list)
})


// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
