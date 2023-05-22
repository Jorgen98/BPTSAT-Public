/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// DB model pre záznamy o priebehu spoja v určitom dni
const delayRecordSchema = new mongoose.Schema({
    // Pole hodnôt meškaní pre jednotlivé časti trasy
    delays: {
        required: true,
        type: [Number]
    },
    // ID spoja
    trip_id: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: 'Trip'
    },
    // Deň platnosti dát
    valid: {
        required: true,
        type: Number
    }
})

module.exports = mongoose.model('DelayRecord', delayRecordSchema)