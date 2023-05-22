/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

const mongoose = require('mongoose');

// DB pre súbory obsahujúce geografické definície fyzickej cestnej a koľajovej infraštruktúry
const pathsSchema = new mongoose.Schema({
    // Uzly
    hubs: {
        required: true,
        type: [{
            // Každý uzol obsahuje svoju polohu
            p: {
                required: true,
                type: [Number]
            },
            // Každý uzol obsahuje svojich susedov, do ktorých je možné prejsť vzhľadom na fyzické a dopravné obmedzenia
            n: {
                required: true,
                type: [Number]
            }
        }]
    },
    // Druh dát v súbore, cestná sieť alebo koľajová sieť
    type: {
        required: true,
        type: String
    }
})

module.exports = mongoose.model('PathsNet', pathsSchema)