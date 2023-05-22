/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

import React, {Component} from "react";
import { Calendar } from 'primereact/calendar';
import { addLocale } from 'primereact/api';
import 'primeicons/primeicons.css';

// Trieda pre analytickú platformu, filtre a kalendár
addLocale('cz', {
    firstDayOfWeek: 1,
    dayNames: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
    dayNamesShort: ['Ned', 'Pon', 'Út', 'Stř', 'Čtv', 'Pát', 'Sob'],
    dayNamesMin: ['N', 'Pon', 'Ú', 'St', 'Č', 'Pá', 'Sob'],
    monthNames: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
    monthNamesShort: ['Led', 'Únr', 'Břez', 'Dub', 'Květ', 'Čer', 'Černc', 'Srp', 'Září', 'Říj', 'List', 'Pros'],
    today: 'Dnes',
    clear: 'Vyčistit'
});

class Stats extends Component {

    constructor(props) {
        super(props);

        this.state = {
            main_div_class: 'st_main_div',
            item_div_class: 'st_item',
            item_one_div_class: 'st_one_item',
            item_nameField_class: 'st_item_name',
            item_valuesField_class: 'st_item_values',
            item_checkBox: 'st_item_check',
            item_checkBoxChecked: 'st_item_checked'
        };

        this.onFillCheckChange = this.onFillCheckChange.bind(this);
        this.onTipCheckChange = this.onTipCheckChange.bind(this);
        this.onDateChange = this.onDateChange.bind(this);
        this.onDateSet = this.onDateSet.bind(this);
    }

    setName(type) {
        if (type === "0") {
            return (<p className='c_categories_in_text'>Filtry</p>)
        } else if (type === "1") {
            return (<p className='c_categories_in_text'>Filtrování podle data</p>)
        } else if (type === "2") {
            return (<p className='c_categories_in_text'>Statistiky příjezdů spoje</p>)
        } else if (type === "3"){
            return (<p className='c_categories_in_text'>Celkové zpoždění mezi zastávkami</p>)
        }
    }

    onFillCheckChange(e) {
        this.props.fillChange();
    }

    onTipCheckChange(e) {
        this.props.tipChange();
    }

    onDateChange(e) {
        this.props.onDatesChange(e);
    }

    onDateSet() {
        this.props.onDatesSet();
    }

    // Podľa toho, čo si používateľ zvolí sa rendruje bočný panel
    setData(type) {
        if (((this.props.data === null) || (this.props.colors === undefined && type === '2')) &&
            (type === '2' || type === '3')) {
            return null
        }
        let stop_details = [];

        // Zobrazovacie filtre
        if (type === '0') {
            stop_details.push([
                <div className={this.state.item_one_div_class} key={0}>
                    <button onClick={this.onFillCheckChange} disabled={this.props.enabled} className={this.props.fillState ?
                        this.state.item_checkBoxChecked : this.state.item_checkBox}>{<i
                        className="pi pi-check"/>}</button>
                    <div className={this.state.item_nameField_class}><p>Umožnit zjednodušenou vizualizaci dat</p></div>
                </div>,
                <div className={this.state.item_one_div_class} key={1}>
                    <button onClick={this.onTipCheckChange} disabled={this.props.enabled} className={this.props.tipState ?
                        this.state.item_checkBoxChecked : this.state.item_checkBox}>{<i
                        className="pi pi-check"/>}</button>
                    <div className={this.state.item_nameField_class}><p>Zobrazit přesné hodnoty zpoždění na mapě</p></div>
                </div>])
        // Kalendár
        } else if (type === '1') {
            let dis = false, min, max, dates = [];
            if (this.props.available.length === 0 || this.props.enabled) {
                dis = true;
            } else {
                min = this.props.available[0];
                max = this.props.available[this.props.available.length - 1];
                let index = 1, value = min.valueOf();
                while (value < max.valueOf()) {
                    if (Math.abs(this.props.available[index].valueOf() - value) !== 24*60*60*1000) {
                        dates.push(new Date(value + 24*60*60*1000));
                    } else {
                        index++;
                    }
                    value += 24*60*60*1000;
                }
            }
            stop_details.push([
            <div className={this.state.item_one_div_class} key={0}>
                <Calendar value={this.props.dates} onChange={(e) => this.onDateChange(e.value)} inline
                          selectionMode="multiple" dateFormat="@" locale='cz' disabled={dis} disabledDates={dates}
                          minDate={min} maxDate={max}
                />
            </div>,
            <div className={this.state.item_one_div_class} key={1}>
                <button onClick={this.onDateSet} id='apply' disabled={dis} className={this.state.item_checkBox}>Načti data</button>
            </div>])
        // Štatistika príchodu spoja do zastávok
        } else if (type === '2') {
            for (let i = 0; i < this.props.data.length; i++) {
                let inner_bars = [];
                for (let j = 0; j < this.props.colors.length; j++) {
                    let delayCategory_per = this.props.data[i].data[j] + '%';
                    let delayCategory_color = this.props.colors[j].col;
                    inner_bars.push(<div key={j} style={{width: delayCategory_per,
                        backgroundColor: delayCategory_color}}/>)
                }

                stop_details.push(<div className={this.state.item_div_class} key={i}>
                    <div className={this.state.item_nameField_class}><p>{this.props.data[i].name}</p></div>
                    <div className={this.state.item_valuesField_class}>{inner_bars}</div>
                </div>)
            }
        // Štatistika meškania medzi zastávkami
        } else if (type === '3') {
            for (let i = 0; i < this.props.data.length; i++) {
                let inner_bars = [];
                let delayCategory_per = this.props.data[i].data + '%';
                inner_bars = <div key={i} style={{width: delayCategory_per, backgroundColor: 'var(--hover-color)'}}/>

                stop_details.push(<div className={this.state.item_div_class} key={i}>
                    <div className={this.state.item_nameField_class}><p>{this.props.data[i].name}</p></div>
                    <div className={this.state.item_valuesField_class}>{inner_bars}</div>
                </div>)
            }
        }

        return stop_details;
    }

    render() {
        return ([
            <div className={this.state.main_div_class}>{this.setName(this.props.type)}</div>,
            <div className={this.state.main_div_class}>{this.setData(this.props.type)}</div>
        ])
    }
}

export default Stats;