// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************


const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords


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



app.get('/welcome', (req, res) => {
    res.json({status: 'success', message: 'Welcome!'});
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



// TODO - Include your API routes here

app.get('/', (req, res) => {
  res.render('pages/login')
});

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
app.get('/home', (req, res) => {
  res.render('pages/home')
});
// Login
app.post('/login', async (req, res) => {
  console.log('username: ', req.body.username);
  console.log('password: ', req.body.password);
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
//--------------------------------------------Add Freind-------------------------------------------------

// Add Friend
app.post("/addFriend", (req, res) => {
  const query1 = "INSERT INTO user_friends (username, friend_username) VALUES ($1, $2)";
  const query2 = "INSERT INTO user_friends (username, friend_username) VALUES ($2, $1)";
  const values = [req.session.username, req.body.friendUserName];
  db.task('get-everything', task => {
    return task.batch([task.any(query1,[values]), task.any(query2,[values])]);
  })
    .then(function () {
      console.log("Successfully added friend!");
      res.redirect("/home");
    })
    .catch(function (err) {
      console.log(err);
      res.redirect("/home");
    });
});
//Add Freind to request Queue
app.post("/addFriendRequest", (req, res) => {
  const query = "INSERT INTO friend_add_queue (username, friend_username) VALUES ($1, $2)";
  const values = [req.session.username, req.body.friend_username];
  db.any(query, values)
    .then(function () {
      console.log("Successfully added friend request!");
      res.redirect("/home");
    })
    .catch(function (err) {
      console.log(err);
      res.redirect("/home");
    });
});
//Friends queue accept or remove
app.delete("/acceptFriend", (req, res) => {
  
  const delete_friend_query = "DELETE FROM friend_add_queue WHERE username = $1 AND friend_username = $2;";
  const values = [req.session.username, req.body.friend_username];
  db.task('get-everything', task => {
    return task.batch(task.any(delete_friend_query,[values]));
  })
    .then(function () {
      console.log("removed from friend Queue");
      res.redirect("/addFriend");
    })
    .catch(function (err) {
      console.log(err);
      res.redirect("/home");
    });
});
app.delete("/declineFriendRequest", (req, res) => {
  const query = "DELETE FROM friend_add_queue WHERE username = $1 AND friend_username = $2;";
  const values = [req.session.username, req.body.friend_username];
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
// Get request for listing friends or friend request
app.get('/friendList', function (req, res) {
  // Fetch query parameters from the request object
  var username = req.session.username;
  

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
app.get('/friendList', function (req, res) {
  // Fetch query parameters from the request object
  var username = req.session.username;
  

  // Multiple queries using templated strings
  
  var friend_add_queue = `select * from friend_add_queue where username=$1`;

  // use task to execute multiple queries
  db.task('get-everything', task => {
    return task.batch([task.any(friend_add_queue, [username])]);
  })
    // if query execution succeeds
    // query results can be obtained
    // as shown below
    .then(data => {
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



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

app.listen(3000);
console.log('Server is listening on port 3000');