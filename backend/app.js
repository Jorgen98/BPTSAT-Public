/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const cron = require('node-cron');
const mongoose = require('mongoose');

const utils = require('./routes/utils');
const netTools = require('./routes/pathNets');
const gtfsTools = require('./routes/gtfs');
const gtfsGetTools = require('./routes/gtfs_gets');
const processingTool = require('./routes/delay_processing');
const processingGetTools = require('./routes/delay_gets');

let app = express();

// Pripojenie DB
let mongoString;
if (process.env.MODE === 'docker') {
    mongoString = 'mongodb://mongo:27017/';
} else {
    mongoString = 'mongodb://localhost:27017';
}

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', (error) => {
    utils.write_to_log(error, 'error');
})

// Inicializačná procedúra
database.once('connected', () => {
    utils.write_to_log('Database Connected', 'root');
    utils.write_to_log('Running delay data processing and GTFS file update on system start', 'root');
    netTools.load_data_to_DB().then(() => {actualisation().then(() => {utils.write_to_log('Initialisation done', 'root')})});
})

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors())
app.disable('x-powered-by')

// API endpointy
app.use('/brno-PTSAT-be/getGTFS', gtfsGetTools);
app.use('/brno-PTSAT-be/getData', processingGetTools);

app.use(function(req, res, next) {
    next(createError(404));
});

// Spracovanie dát, spúšťané automaticky ráno o 1:15
cron.schedule('15 1 * * *', () => {
    utils.write_to_log('Running everyday task', 'root');
    actualisation().then(() => {utils.write_to_log('Everyday task done', 'root')});
});

app.use(function(err, req, res, next) {
    res.send(err.message);
});

async function actualisation() {
    await processingTool.process_data();
    await gtfsTools.actualise_GTFS_data();
}

module.exports = app;
