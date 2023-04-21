// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************


const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part B.

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
app.use(express.static('functions'));
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

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

//--------------------------------------------- R E G I S T E R ---------------------------------------------------------//

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


app.get('/home', (req, res) => {
  res.render('pages/home', { data: null });
});

app.post('/home', async (req, res) => {
  const request = `http://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${req.body.location}&days=7`;
  await axios({
    url: request,
    method: 'GET',
    dataType: 'json',
  })
    .then(results => {
      console.log("query results", results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
      res.render('pages/home', {
        data: results.data,
      })
    })
    .catch(error => {
      console.log("There was and error!", error);
      res.render('pages/home', {
        error: error,
        data: null
      })
    });
})
//--------------------------------------------- L O G I N ---------------------------------------------------------//

app.get('/login', (req, res) => {
  res.render('pages/login');
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



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');