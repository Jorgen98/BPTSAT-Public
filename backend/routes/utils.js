/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

// Pomocná funkcia pre formátový výpis do konzoly
function write_to_log(message, type) {
    let date = new Date();
    let color;
    let def_color = "\x1b[0m";
    let header;

    switch (type) {
        case 'root': color = "\x1b[90m"; header = 'ROOT'; break;
        case 'gtfs': color = "\x1b[93m"; header = 'GTFS'; break;
        case 'paths': color = "\x1b[96m"; header = 'PATH FILES'; break;
        case 'suc': color = "\x1b[92m"; header = 'OK'; break;
        case 'prog': color = "\x1b[93m"; header = 'PROCESSING'; break;
        case 'proc': color = "\x1b[33m"; header = 'DELAY DATA PROCESSING'; break;
        case 'fail': color = "\x1b[91m"; header = 'ERROR'; break;
        default: return;
    }

    message = date.toLocaleString('en') + ' ' + color + header + def_color + ' ' + message;
    console.log(message);
}

// Pomocná funkcia pre výpis priebehu nejakej operácie
function progress_log(name, maximum) {
    return {
        ac_value: 0,
        maximum: maximum,
        name: 'Duration of ' + name + ' processing',
        actualise: function (val) {
            if (Math.floor((val / this.maximum) * 100) > this.ac_value) {
                this.ac_value = Math.floor((val / this.maximum) * 100);
                write_to_log(name + ': ' + this.ac_value + '%', 'prog');
            }
        },
        start: function () {
            console.time(this.name);
        },
        finish: function () {
            console.timeEnd(this.name);
        }
    }
}

module.exports = { write_to_log, progress_log };