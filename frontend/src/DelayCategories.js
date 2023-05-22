/*
 * DP - Juraj Lazúr, xlazur00
 * FIT VUT, Božetěchova 2, 612 00 Brno, Česká republika
 *
 * Máj 2023
 */

import React, {Component} from "react";
import * as ReactDOM from 'react-dom/client';

class Categories extends Component {

    inner_props = {
        render_div: null
    }

    constructor(props) {
        super(props);

        this.state = {
            render_div_id: 'c_render_div',
            categories: []
        };

        // Pri inicializácií vytvoríme 4 základné kategórie
        if (props.categories !== null) {
            this.state.categories = props.categories;
        } else {
            this.state.categories = [
                {'val': 0, 'col': '#00b159'},
                {'val': 1, 'col': '#ffc425'},
                {'val': 2, 'col': '#f37735'},
                {'val': 3600, 'col': '#d11141'}
            ]
        }
    }

    // Zmena farby kategórie
    onColorChange(index, color) {
        let categories = this.state.categories;

        categories[index].col = color;

        this.setState({categories: categories});
        this.prepareDivElements(true, index);
    }

    // Funkcia upravujúca poradie kategórií podľa hodnoty
    sortValues(el1, el2) {
        if ( el1.val < el2.val ){
            return -1;
        }
        if ( el1.val > el2.val ){
            return 1;
        }
        return 0;
    }

    // Zmena hodnty meškania
    onValueChange(index, value) {
        let categories = this.state.categories;

        let real_value = parseFloat(value);

        if (real_value < 0) {
            categories[index].val = 0;
        } else if (real_value > 3600) {
            categories[index].val = 3600;
        } else {
            categories[index].val = real_value;
        }

        let elem = categories[index];

        categories = categories.sort(this.sortValues)

        this.setState({categories: categories});
        this.prepareDivElements(true, categories.indexOf(elem));
    }

    // Pridanie novej kategórie meškania
    addCategory() {
        let categories = this.state.categories;
        let new_value = 0;

        if (categories.length > 1) {
            new_value = categories[categories.length - 2].val + 0.5;
        }

        let new_item = {'val': new_value, 'col': '#d11141'}

        categories.splice(categories.length - 1, 0, new_item);

        this.setState({categories: categories});

        this.prepareDivElements();
    }

    // Vymazanie kategórie meškania
    delCategory(index) {
        let categories = this.state.categories;

        categories.splice(index, 1);

        this.setState({categories: categories});
        this.prepareDivElements();
    }

    createStamp(index, is_edit, is_hook) {
        let hook;
        let category_class;
        let button_text;

        if (is_hook) {
            hook = () => this.prepareDivElements()
            category_class = 'c_categories_in_stamp_sel'
        } else {
            hook = () => this.prepareDivElements(true, index);
            category_class = 'c_categories_in_stamp'
        }

        if (this.state.categories.length - 1 > index) {
            button_text = this.state.categories[index].val.toString() + ' min';
        } else {
            button_text = 'ostatní zpoždění';
        }

        return (<button key={index.toString()} className={category_class}
                        style={{backgroundColor: this.state.categories[index].col}}
                        onClick={hook}>{button_text}</button>);
    }

    prepareDivElements(edit= false, index = 0) {
        let rendered_elems = [];
        let delay_stamps = [];

        for(let i = 0; i < this.state.categories.length; i++) {
            delay_stamps.push(this.createStamp(i, edit, edit && i === index));
        }

        delay_stamps.push(<button onClick={() => this.addCategory()} className='c_categories_add_but' key='+'>+</button>);

        rendered_elems.push(<div className='c_categories_stamps_div'>{delay_stamps}</div>);

        if (edit) {
            let elem_in;
            const color_input = <input type='color' value={this.state.categories[index].col}
                                       className='c_categories_in_color' key={1}
                                       onChange={event => this.onColorChange(index, event.target.value)}/>;

            if (index < this.state.categories.length - 1) {
                elem_in = ([
                    <button onClick={() => this.delCategory(index)} className='c_categories_but' key={0}>-</button>,
                    color_input,
                    <input type='number' value={this.state.categories[index].val.toString()} key={2}
                           className='c_categories_in_text' step='0.5'
                           min='0'
                           max='3600'
                           onChange={event => this.onValueChange(index, event.target.value)}/>,
                    <p className='c_categories_in_text' key={3}>min.</p>
                ])
            } else {
                elem_in = ([color_input, <p className='c_categories_in_text' key={4}>vyšší hodnoty zpoždění</p>])
            }

            const elem = (<div key={index.toString()} className='c_categories_cat'>{elem_in}</div>);

            rendered_elems.push(elem);
        }

        this.inner_props.render_div.render(rendered_elems);
        this.props.getCategories(this.state.categories);
    }

    componentDidMount() {
        if (this.inner_props.render_div === null) {
            this.inner_props.render_div = ReactDOM.createRoot(document.getElementById(this.state.render_div_id));
        }

        this.prepareDivElements();
    }

    render() {
        return (
            <div id={this.state.render_div_id} className="c_main_div" onClick={event => event.stopPropagation()}
                 onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
                 onScroll={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}/>
        )
    }
}

export default Categories;