// Imports the index.js file to be tested.
const server = require('../index'); //TO-DO Make sure the path to your index.js is correctly added
// Importing libraries

// Chai HTTP provides an interface for live integration testing of the API's.
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });

  // ===========================================================================
  // TO-DO: Part A Login unit test case

  //Negative cases
  it('Negative : /login case where neighter username nor passwords exist in the table', done => {
    chai
      .request(server)
      .post('/login')
      .send({username: '', password: ''})
      .redirects(0)
      .end((err, res) => {
        res.should.redirectTo('/register');
        done();
      });
  });

  it('Negative : /login case where username is in the table, but the password is not', done => {
    chai
      .request(server)
      .post('/login')
      .send({username: 'shadow', password: ''})
      .redirects(0)
      .end((err, res) => {
        res.should.redirectTo('/login');
        done();
      });
  });

  // Positive test case, where both username and password are in the table
  it('Positive : /login is successful', done => {
    chai
      .request(server)
      .post('/login')
      .send({username: 'shadow', password: 'toor'})
      .redirects(0)
      .end((err, res) => {
        res.should.redirectTo('/home');
        done();
      });
  });

  // Test cases for registration

  
  // Negative test case for the registration api
  it('Negative: /register fails due to the username being already taken', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'shadow', password: 'foorloop'})
      .redirects(0)
      .end((err, res) => {
        res.should.redirectTo('/register');
        done();
      });
  });

  it('Positive: /register successfully registers a new user', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'adam', password: 'hello'})
      .redirects(0)
      .end((err, res) => {
        res.should.redirectTo('/login');
        done();
      });
  });

  // Positive test case for the registration api
});