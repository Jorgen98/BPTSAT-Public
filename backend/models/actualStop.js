/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre aktuálne verzie zastávok
const actualStopSchema = new mongoose.Schema({
    stops: [{
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Stop'
    }]
})

module.exports = mongoose.model('actualStop', actualStopSchema);