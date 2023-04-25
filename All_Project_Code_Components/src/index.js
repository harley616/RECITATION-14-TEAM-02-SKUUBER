
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

let sessionUser;

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

app.use( express.static( "public" ) );


// TODO - Include your API routes here

app.get('/', (req, res) => {
  res.render('pages/login')
});

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
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
            // the padding is (3.125vh * hours)
            // this is where on the calendar the event shows up
            const hours = new Date(event.date).getHours();
            obj.hours = hours;
            obj.padding = (3.125 * hours).toFixed(2) + 'vh';
            return obj;
        })
        calendarList[i] = mappedDayEvents;
    }

    return calendarList;

}

app.get('/calendar', async (req, res) => {
    const owner = req.session.user[0]['username'];
    const get_events_query = `select * from events where owner = $1`;
    var values  = [owner];
    const get_event_result = await db.any(get_events_query, values);
    console.log('successfully got events for user: ' + owner);

    //******* friend stuff *******/

    // add any events that you are shared with
    const get_shared_events_query = `select * from users_to_events where username = $1`;
    var values  = [owner];
    const get_shared_event_result = await db.any(get_shared_events_query, values);
    // list of event_id
    const shared_event_ids = get_shared_event_result.map(event => event.event_id);
    console.log('shared_event_ids: ', shared_event_ids);
    // get all the events with those event_ids, as long as event.owner != owner
    const get_shared_events_query2 = `select * from events where event_id = ANY($1)`;
    var values  = [shared_event_ids];
    const get_shared_event_result2 = await db.any(get_shared_events_query2, values);
    console.log('successfully got shared events for user: ' + owner);
    const shared_events = get_shared_event_result2;
    console.log('shared_events: ', shared_events);

    // filter shared events, only keep the ones that are not owned by owner
    const filtered_shared_events = shared_events.filter(event => event.owner != owner);
    console.log('filtered_shared_events: ', filtered_shared_events)
    console.log('event result: ', get_event_result)
    const full_events = []. concat(get_event_result, filtered_shared_events);
    console.log('full_events: ', full_events)
    const processed_full_events = processData(full_events);

    res.render('pages/calendar', {calendarData: processed_full_events});
})

//WORKS dont fuck with it
app.get('/friend_calendar', async (req, res) => {
    // get list of your friends
    const owner = req.session.user[0]['username'];
    const get_friends_query = `select * from user_friends where username = $1`;
    var values  = [owner];
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
        var values  = [friend_username];
        const get_friend_events_result = await db.any(get_friend_events_query, values);
        console.log('successfully got events for user: ' + friend_username);
        const friend_events = get_friend_events_result[0];
        for (let j = 1; j < get_friend_events_result.length; j++) {
            friendEvents.push(get_friend_events_result[j]);
        }
    }
    const processed_calendar_data = processData(friendEvents);
    res.render('pages/friend_calendar', {calendarData: processed_calendar_data}); 
})


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
   res.render('pages/login', {loginFailed: false})
});

// Login
app.post('/login', async (req, res) => {
  console.log('username: ', req.body.username);
  console.log('password: ', req.body.password);
  //console.log('hashed password: ',  await bcrypt.hash(req.body.password, 10));
  const username= req.body.username;
  sessionUser = username;
  try {
  const user = await db.query('SELECT * FROM users WHERE username = $1', [username]);  //Checking if username exists in the table
  if(user.length === 0){                                                                        //if username does not exist: 
    console.log('Username not found.');
    await res.render('pages/login', {loginFailed: true});                                                  //redirect to registration page
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



  // ------------------------------------------------------------------

 

  app.get('/home', (req, res) => {
    const user = sessionUser;
    const query = "SELECT * FROM users where users.username != $1";

    db.any(query, [user])
    .then(users => {
      res.render('pages/home', {
        users
      });
    })
    .catch((err) => {
      console.log('Error: users api failed.');
      console.log(err);
      res.render('pages/home'), {
        users: []
      };
    })
  });

  app.post('/home/add_friends', (req, res) => {
    const query = " INSERT INTO user_friends(username, friend_username) VALUES ($1, $2);";
    console.log(sessionUser);
    console.log(req.body.username);
    db.any(query, [sessionUser, req.body.username])
    .then((users) => {
      res.render("pages/home", {
        users
      });
    })
    .catch((err) => {
      console.log(err),
      res.render("pages/home", {
        users: [],
        error: true,
      })
    });
  });

  // ------------------------------------------------------------------

// add an event for a user
// must have a NAME, TIME (in hours, 0-24), LOCATION (Boulder, CO)


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