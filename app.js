var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var path = require('path'); // core module
var mongoose = require('mongoose');
var session = require('express-session');
var MemoryStore = require('memorystore')(session);

mongoose.connect(process.env.CSDB, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.once('open', () => { console.log("Connected to DB") });

var app = express();

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(cookieParser());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Express session
app.use(session({
	secret: 'secret',
	saveUninitialized: true,
	resave: true,
	cookie: { secure: false },
	store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 * 12 })
}));

// Global variables
app.use((req, res, next) => {
	// res.locals.production = production;
	next();
});

app.use('/', require('./routes/index'));
app.use('/news', require('./routes/news'));
app.use('/artists', require('./routes/artists'));
app.use('/discography', require('./routes/discography'));
app.use('/mailing-list', require('./routes/mailing-list'));

app.get("*", (req, res) => {
	res.status(404).render('error', { title: "Error 404", pagename: "error" });
});

// Set port + listen for requests
var port = process.env.PORT || 4001;
app.listen(port, () => {
	console.log('Server started on port '+ port);
});
