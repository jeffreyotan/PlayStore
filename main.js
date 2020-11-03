// load modules and libraries
const express = require('express');
const handlebars = require('express-handlebars');
const mysql = require('mysql2/promise');

// configure the port to listen to
const PORT = parseInt(process.argv[2]) || parseInt(process.env.APP_PORT) || 3000;

// SQL templates
const SQL_GET_APP_CATEGORIES = 'select distinct(category) from apps';
const SQL_GET_APPS_BY_CATEGORY = 'select app_id, name from apps where category like ? limit ?';
const SQL_GET_APP_DETAILS_BY_APPID = 'select * from apps where app_id like ?';

// global constants
const QUERYLIMIT = 20;

// configure the connection to the DB
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PW,
    database: process.env.DB_NAME || 'playstore',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
});

// create an instance of the express server
const app = express();

// configure express to use handlebars
app.engine('hbs', handlebars({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');

app.get('/', async (req, res, next) => {
    const conn = await pool.getConnection();

    try {
        const results = await conn.query(SQL_GET_APP_CATEGORIES);
        const categories = results[0].map(v => v.category);
        // console.info('Categories obtained are: ', categories);

        res.status(200).type('text/html');
        res.format({
            'text/html': () => {
                res.type('text/html');
                res.render('index', { selection: categories });
            },
            // This is for practice only. If it is a normal program, we will not structure like this
            default: () => { 
                res.type('text/html');
                res.render('index', { selection: categories, hasData: false });
            }
        });
    } catch(e) {
        res.status(500).type('text/html');
        res.send(JSON.stringify(e));
    } finally {
        conn.release();
    }
});

app.get('/search', async (req, res, next) => {
    const conn = await pool.getConnection();

    try {
        const results = await conn.query(SQL_GET_APPS_BY_CATEGORY, [ req.query['categories'], QUERYLIMIT ]);
        // console.info("results received: ", results[0]);

        const data = results[0];

        res.status(200).type('text/html');
        res.render('index', { selection: [req.query['categories']], hasData: data.length > 0, data });
    } catch(e) {
        console.error('The search produced an error: ', e);
        res.status(500).type('text/html');
        res.send('<h3>An internal server error occurred with the provided search key.</h3>');
    } finally {
        conn.release();
    }
});

app.get('/app/:app_id', async (req, res, next) => {
    const conn = await pool.getConnection();

    try {
        const results = await conn.query(SQL_GET_APP_DETAILS_BY_APPID, [req.params['app_id']]);
        const details = results[0];
        console.info("App ID details: ", details);

        res.status(200);
        res.format({
            'text.html': () => {
                res.type('text/html');
                res.render('details', { app_id: details[0].app_id, name: details[0].name, category: details[0].category, rating: details[0].rating, installs: details[0].installs });
            }
        });
    } catch(e) {
        console.error('The provided App ID caused an error: ', e);
        res.status(404).type('text/html');
        res.send(`<h3>Page not found with App ID: ${req.params['app_id']}</h3>`);
    } finally {
        conn.release();
    }
});

// start the server
pool.getConnection()
    .then(conn => {
        console.info('Pinging database..');
        const p0 = Promise.resolve(conn);
        const p1 = conn.ping();
        return Promise.all([p0, p1]);
    })
    .then(results => {
        const conn = results[0];

        // release the connection
        conn.release();

        // start the server
        app.listen(PORT, () => {
            console.info(`Server start at port ${PORT} on ${new Date()}`);
        });
    })
    .catch(e => {
        console.error("Server not started as there was an internal server error. ", e);
    });