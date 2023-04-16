const express = require('express'); // To build an application server or API
const app = express();

app.get('/welcome', (req, res) => {
    res.json({ status: 'success', message: 'Welcome!' });
});


module.exports = app.listen(3000);
console.log('Server is listening on port 3000');