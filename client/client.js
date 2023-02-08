const express = require('express');
const app = express();
const path = require('path');
const ejs = require('ejs');
const port = 9000;

app.engine('.html', ejs.__express);
app.set('views', path.join('./src/views/'));
app.set('view engine', 'ejs');
app.use(express.static(path.join('./src/public')));

app.get('/', (req, res) => {
    res.render('index.html');
})

app.listen(port, function (err) {
    if (err) throw err;
    console.log('Client Listening on port', port);
});