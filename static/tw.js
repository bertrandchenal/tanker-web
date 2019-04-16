'use strict'

const burger_icon = '\u2630';
const check_icon = '\u2714';
const cross_icon = '\u274C';
const plus_icon = '\u2795';

var root = function(body) {
    var menu_wrap = one(body, 'div#main-menu.uk-width-1-1');
    var menu_row = one(menu_wrap, 'div');
	menu_row.attr('uk-grid', true);

    var content_wrap = one(body, 'div#main-content.uk-width-1-1');
    var content_row = one(content_wrap, 'div');
	content_row.attr('uk-grid', true);

    // Add context of observables
    var ctx = {
        'resp': new Observable(),
        'table_name': new Observable(),
        'filters': new Observable({}),
        'sort': new Observable(),
        'edited': new Observable(false),
        'mode': new Observable('table'),
        'x_axis': new Observable(),
        'y_axis': new Observable(),
		'table_thumbs': new Observable(['plant', 'country']),
    }
    set_context(body, ctx);
    menu(menu_row);

    // Show table or graph based on mode
	thumbs_col(content_row);
    table(content_row);
    // graph(content_row);
}


var thumbs_col = function(content_row) {
    var ctx = get_context(content_row);
    // Add table node
    var col = one(content_row, 'div#thumb-col.uk-width-1-4')
    new Observable(function() {
        var val = ctx.mode();
        col.style('display', val == 'table' ? '' : 'none');
    });

	// Add title
	var title = one(col, 'h1');
	title.text('Menu');

	// Table adder
    var input = one(col, 'input');
    // Plug typeahead
    var route = (content) => '/search_table/' + content;
    input.on('input', debounce(curry(typeahead, route, function(name) {
		var table_thumbs = ctx.table_thumbs();
		table_thumbs.push(name);
		ctx.table_thumbs.trigger();
	}, true)))
    input.attr('placeholder', 'Select a table to query');

    // Add thumbnails div
    var thumblist = one(col, 'div');
	ctx.table_thumbs.subscribe(function(thumbs){
		var [all_cards, new_cards] = join(thumblist, 'div.collapse', thumbs);
		show_thumb(new_cards)
	});
	ctx.table_thumbs.trigger()
}

var show_thumb = function(new_cards) {
    var ctx = get_context(new_cards);

	// Collapse hidden checkbox
	var inputs = new_cards.append('input');
	inputs.attr('type', 'radio');
	inputs.attr('id', (table, id) => `thumbs-section-${id}`);

	// Collapse title
	var labels = new_cards.append('label')
	// labels.attr('for', (table, id) => `thumbs-section-${id}`);
	labels.text(noop);
	labels.on('click', ctx.table_name);


	// Collapse content
	var contents = new_cards.append('div');
	var info = contents.append('p');
	info.text('hello');



	// Collapse content
	// var card_tops = new_cards.append('div');
	// card_tops.attr('class', 'section row');
	// var titles = card_tops.append('p');
	// titles.text(noop);
	// titles.on('click', ctx.table_name);
	// var detail_btns = card_tops.append('mark');
	// detail_btns.text(burger_icon);


	// // card content
	// var card_inners = new_cards.append('div');
	// card_inners.attr('class', 'section row');

	// // Card footer
	// var card_footers = new_cards.append('div');
	// card_footers.attr('class', 'section row');
	// var join_btns = card_footers.append('button');
	// join_btns.text('join');

}

var table = function(content_row) {
    var ctx = get_context(content_row);
    // Add table node
    var col = one(content_row, 'div#table-col.uk-width-expand')
    new Observable(function() {
        var val = ctx.mode();
        col.style('display', val == 'table' ? '' : 'none');
    });

    var table_el = one(col, 'table.uk-table.uk-table-justify');
    // Add thead & table rows
    thead(table_el);
    // Add table buttons
    table_menu(table_el)
    // Auto-load first table
    ctx.table_name('prm_plant');
}

var graph = function(content_row) {
    var ctx = get_context(content_row);

    // Add graph menu
    graph_menu(content_row);
    ctx.resp.subscribe(curry(graph_menu, content_row));
    ctx.mode.subscribe(curry(graph_menu, content_row));
}


var graph_menu = function(content_row) {
    var ctx = get_context(content_row);
    if (!ctx.resp()) {
        return;
    }

    var menu_div = one(content_row, 'div#graph-menu');
    var axes = ['x', 'y'];
    var params = {};
    var [selects] = join(menu_div, 'select', axes);
    var cols = ctx.resp().columns;
    cols = cols[cols.length - 1];
    cols = cols.map((c) => c.label);
    var [options] = join(selects, 'option', cols);
    options.text(noop)

    // Add graph div
    var graph_div = one(content_row, 'div#graph');
    selects.on('change', function (datum, idx) {
        ctx[datum + '_axis'](this.value);
        populate_graph(graph_div);
    });

    // Remove it if mode is changed
    new Observable(function() {
        var val = ctx.mode();
        graph_div.style('display', val == 'graph' ? '' : 'none')
    });

}

var populate_graph = function(div) {
    var ctx = get_context(div);
    if (ctx.mode() != 'graph') {
        // nothing to do
        return;
    }
    if (!ctx.x_axis() || ! ctx.y_axis()) {
        return;
    }

    // Extract column names
    var cols = ctx.resp().columns;
    cols = cols[cols.length - 1];
    cols = cols.map((c) => c.label);

    // Loop on rows to create records
    var rows = ctx.resp().rows;
    var values = rows.map(function(row) {
        var zipped = d3.zip(cols, row);
        var record = zipped.reduce(function(record, item) {
            record[item[0]] = item[1];
            return record;
        }, {})
        return record;
    });

    var spec = {
        'data': {
            "values": values
        },
        'mark': 'line',
        'encoding': {
            'x': {
                'field': ctx.x_axis(),
                'type': 'quantitative',
                'sort': false,
            },
            'y': {
                'field': ctx.y_axis(),
                'type': 'ordinal',
                'sort': false,
            },
            'tooltip': {
                'field': 'value',
                'type': 'quantitative',
            },
        }
    }
    var opt = {
        mode: 'vega-lite',
        actions: {export: true, source: false, editor: false}
    };
    vegaEmbed('#graph', spec, opt);


}


var menu = function(menu_row) {
    var ctx = get_context(menu_row);
    var left_col = one(menu_row, 'div.uk-width-expand');


    // Add buttons
    var btn_group = one(left_col, 'div.uk-button-group');

    var mode_btn = one(btn_group, 'button.uk-button.uk-button-default');
    new Observable(function() {
        var label = ctx.mode() == 'table' ? 'Graph': 'Table';
        mode_btn.text(label);
    });
    mode_btn.on('click', () => ctx.mode(ctx.mode() == 'table' ? 'graph': 'table'))
}

var thead = function(root) {
    var ctx = get_context(root);
    // Add nodes
    var thead_el = one(root, 'thead');

    // Reset observables when table_name is changed
    var reset = function() {
        ctx.filters({});
        ctx.sort(null);
        ctx.edited(false);
    }
    ctx.table_name.subscribe(reset);

    // Plug data loading
    var debounced_query = debounce(query);
    var launch_query = function() {
        if (!ctx.table_name()) {
            return;
        }
        var url = '/read/' + ctx.table_name() + '.json';
        var encode_param = ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        var params = Object.entries(ctx.filters()).map(encode_param);
        if (ctx.sort()) {
            params.push(encode_param([':sort', ctx.sort()]));
        }
        if (params.length) {
            url = url + '?' + params.join('&');
        }
        debounced_query(url, ctx.resp);
    };
    new Observable(launch_query);
    ctx.resp.subscribe(function () {
        // Add headers
        headers(thead_el);
        // Add tobdy
        tbody(root);
    });
}

var headers = function(root) {
    var ctx = get_context(root);
    var columns = ctx.resp().columns
    var [all, enter] = join(root, 'tr', columns);
    header_cell(all, noop);
}

var header_cell = function(root, data) {
    var [all, enter] = join(root, 'th.header', data);
    all.attr('colspan', d => d.colspan);
	var [labels] = join(all, 'p.uk-button');
    labels.text(function(d) {
		return d.label;
	});
    header_menu(root, all);
}

var header_menu = function(parent, headers) {
    var ctx = get_context(parent);
    var filters = ctx.filters();
    var resp = ctx.resp();

    var [card] = join(headers, 'div.uk-card.uk-card-default.uk-card-body');
	card.attr('uk-dropdown', 'mode: click; pos: bottom-left; delay-hide: 0');

	// Close button
    var [close_div] = join(card, 'div#close.uk-width-1-1.uk-flex.uk-flex-right');
    var [close_span] = join(close_div, 'span.uk-button.uk-button-small');
	close_span.attr('uk-icon', 'icon: close');
	close_span.on('click', function(el) {
		UIkit.dropdown(card.node()).hide();
	});

    // Add title
    var [title] = join(card, 'h3');
    title.text(d => d.label);

    // Add form
    var [form] = join(card, 'form.uk-form-stacked');

    // Add filter
	var [filter_div] = join(form, 'div#filter.uk-margin');
    var [filter_label] = join(filter_div, 'label.uk-form-label');
    filter_label.text('Filter');
    filter_label.attr('for', 'column-filter');
	var [input_div] = join(filter_div, 'div.uk-inline');
	var [anchor] = join(input_div, 'a.uk-form-icon.uk-form-icon-flip');
	anchor.attr('uk-icon', 'icon: close; ratio: 0.7');
    var [filter_input] = join(input_div, 'input.uk-input');
    filter_input.attr('placeholder', 'Filter');
    filter_input.property('value', function(d, i) {
		return filters[d.name] || '';
	});
	anchor.on('click', function(datum, idx) {
		var parent = d3.select(this.parentNode);
		var input = parent.selectAll('input');
		input.property('value', '');
        filters[datum.name] = '';
        ctx.filters.trigger();
	})
    var filter_fun = function(input, datum) {
        // Update context
        var value = input.property('value')
        // Update filter dict & trigger refresh
        filters[datum.name] = value;
        ctx.filters.trigger();
    };
    filter_input.on('keydown', function(d, idx) {
        var code = d3.event.keyCode;
        if (code == 13) {
            // 13 is enter
            d3.event.preventDefault();
            filter_fun(d3.select(this), d);
			UIkit.dropdown(card.node()).hide();
        }
    });
	var [ok_btn] = join(filter_div, 'span.uk-button.uk-button-primary');
	ok_btn.attr('uk-icon', 'icon: check; ratio: 1.2');
	ok_btn.on('click', function(datum, idx) {
		var parent = d3.select(this.parentNode)
		var input = parent.selectAll('input');
		filter_fun(input, datum)
		// var value = input.property('value');
        // filters[datum.name] = value;
        // ctx.filters.trigger();
	});



    // Add sorting
    var [sort_group] = join(form, 'div#sort.uk-margin');
    var [sort_label] = join(sort_group, 'label.uk-from-label');
    sort_label.text('Sort');
    var [sort_btn_group] = join(sort_group, 'div#uk-form-controls');
    var sort_btn_type = ['Ascending', 'Descending'];
    var [sort_btn_all] = join(sort_btn_group, 'button.uk-button.uk-button-small', function(d) {
		return [{datum: d, type: 'Ascending'}, {datum: d, type: 'Descending'}];
	});
    sort_btn_all.text((d) => d.type);
    sort_btn_all.attr('id', (d) => 'btn-' + d.type.toLowerCase());
    sort_btn_all.on('click', function(d) {
        d3.event.preventDefault();
        ctx.sort(d.datum.name + (d.type == 'Ascending' ? ':asc' : ':desc'))
    });
    // var ok_fun = function(d) {
    //     // Update context
    //     var value = filter_input.property('value')
    //     // Update filter dict & trigger refresh
    //     filters[d.name] = value;
    //     ctx.filters.trigger();
    //     // div.remove();
    // };



    // // Fill footer section
    // var [footer_row] = join(card, 'div#popup-footer.uk-card-footer');
    // var ok_btn = one(footer_row, 'button#ok.uk-button.uk-button-default');
    // ok_btn.text('Ok').attr('class', 'uk-button uk-button-default');
    // var cancel_btn = one(footer_row, 'button#cancel');
    // cancel_btn.text('Cancel').attr('class', 'uk-button uk-button-default');

    // // Plug events
    // ok_btn.on('click', ok_fun)
    // cancel_btn.on('click', function() {
    //     // div.remove();
    // });

}

var tbody = function(root) {
    var ctx = get_context(root);
    var rows = ctx.resp().rows;
    var tbody = one(root, 'tbody');
    var [all, enter] = join(tbody, 'tr', rows);
    body_cell(all, noop);
}


var body_cell = function(root, row) {
    var [all, enter] = join(root, 'td', row);
    all.text(printable);
    enter.on('click', edit_cell);
    enter.on('focusin', edit_cell);
}


var edit_cell = function(datum, idx, nodes) {
    var td = d3.select(this);
    var tr = d3.select(this.parentNode);
    ctx = get_context(this);

    // Update active class
    d3.select('.active').classed('active', false);
    tr.attr('class', 'active edited')
    ctx.edited(true);

    // Makes cells editable
    tr.selectAll('td').attr('contenteditable', 'true');
    // set focus
    td.node().focus()
    // Get column definition
    var ctx = get_context(this);
    var table_name = ctx.table_name();
    var resp = ctx.resp();
    // (Columns is a list of lists)
    var child_cols = resp.columns[resp.columns.length - 1];
    var column = child_cols[idx];

    // Bind return
    tr.on('keydown', function() {
        var code = d3.event.keyCode;
        if (code == 13) {
            // 13 is enter
            d3.event.preventDefault();
            var shifted = d3.event.shiftKey;
            var tr_node = tr.node();
            var next_tr = shifted ? tr_node.previousElementSibling
                : tr_node.nextElementSibling
            // Trigger click on the sibling td
            if (next_tr) {
                next_tr.children[idx].click()
            }
        }
    });

    if (column.name.indexOf('.') < 0) {
        return;
    }
    // Enable typeahead on fk
    var route = (content) => `/search/${table_name}/${column.name}/`
        + encodeURIComponent(content);
    td.on('input', debounce(curry(typeahead, route, noop)));

}


var table_menu = function(root) {
    var ctx = get_context(root);
    // Add div to body
    var body = d3.select('body');
    var btn_group = one(body, 'div#table_menu');
    btn_group.attr('class', 'popup shadowed')
	btn_group.style('display', 'none')
    // add collapsible div
    var collapsible = one(btn_group, 'div');
    collapsible.style('display', 'none');

    // Hide btn_group if mode change
    new Observable(function() {
    });
    // Plug scrolling refresh
    var refresh_btn_group = function() {
        var table_geo = get_node_geo(root.node());
        var show = ctx.mode() == 'table' && table_geo.w > 5
		btn_group.style('display',  show ? '' : 'none')
        var btn_group_geo = get_node_geo(btn_group.node());
        var scroll_top = document.documentElement.scrollTop;
        var viewport_bottom = scroll_top + window.innerHeight - btn_group_geo.h;
        var table_bottom = table_geo.y + table_geo.h + 5;
		var table_right = window.innerWidth - ( table_geo.x + table_geo.w);
        var bottom = Math.min(table_bottom, viewport_bottom);
        btn_group.transition()
            .style('right', (table_right - 5) + 'px')
            .style('top', (bottom - 5) + 'px');
    }
    ctx.resp.once(() => setTimeout(refresh_btn_group, 500));
    ctx.mode.subscribe(refresh_btn_group);
    ctx.filters.subscribe(refresh_btn_group);
    ctx.table_name.subscribe(() => setTimeout(refresh_btn_group, 500));
    d3.select(window).on('scroll', debounce(refresh_btn_group));

    // Add delete button
    var del_btn = one(collapsible, 'button#delete.uk-button.uk-button-default');
    del_btn.html('Delete&nbsp;' + cross_icon);
    del_btn.on('click', function() {
        var rows = root.select('.active').classed('deleted', true);
        ctx.resp.trigger();
    });

    // Add new button
    var new_btn = one(collapsible, 'button#new.uk-button.uk-button-default');
    new_btn.html('New&nbsp;' + plus_icon);
    new_btn.on('click', function() {
        window.scrollTo(0,document.body.scrollHeight);
        var ctx = get_context(root);
        var rows = ctx.resp().rows;
        var cols = ctx.resp().columns;
        cols = cols[cols.length - 1];
        var empty_row = cols.map((c) => '');
        rows.push(empty_row);
        ctx.resp.trigger();
        refresh_btn_group();
    });

    // Add Save button
    var save_btn = one(collapsible, 'button#save.uk-button.uk-button-default');
    save_btn.html('Save&nbsp;' + check_icon);
    new Observable(function() {
        save_btn.attr('disabled', ctx.edited()? null : true)
    });
    save_btn.on('click', function() {
        var post_data = root.selectAll('.edited').nodes().map(function(tr) {
            var row = d3.select(tr).selectAll('td').nodes().map(function(td) {
                return td.innerText;
            });
            return row;
        });
        var url = '/write/' + ctx.table_name()
        d3.select('html').classed('wait', true);
        var callback = () => d3.select('html').classed('wait', false);
        query(url, callback, post_data);
        ctx.edited(false);
    });

    // Add burger icon
    var burger_btn = one(btn_group, 'button#burger.uk-button.uk-button-primary');
    burger_btn.text(burger_icon);
    var collapsed = true;
    burger_btn.on('click', function() {
        collapsed = !collapsed;
        collapsible.style('display', collapsed ? 'none': 'inline-block')
    });

}

var one = function(el, tag) {
    var [all, enter] = join(el, tag, [null]);
    return all;
}

var append = function(parent, tag) {
    // extract classes
    var by_class = tag.split('.')
    tag = by_class[0]
    // extract id
    var by_id = tag.split('#')
    tag = by_id[0]

    var el = parent.append(tag)
    // Set id or class
    if (by_id.length > 1) {
        el.attr('id', by_id[1]);
    }
    // Add classes
    var classes = by_class.slice(1).join(' ');
    if (classes.length) {
        el.attr('class', classes)
    }
	return el;
}

var join = function(parent, tag, data) {
    // select children
    var select = parent.selectAll(tag).data(data || pack);
    // Remove old nodes and add new
    var exit = select.exit()
    exit.remove();
    var enter = append(select.enter(), tag);

    // Merge
    var all = enter.merge(select);
    return [all, enter, exit];
}


var set_context = function(node, value) {
    // Get node of d3 selections
    if (node.node) {
        node = node.node();
    }
    node._ctx = value;
}

var get_context = function(node, value) {
    // Get node of d3 selections
    if (node.node) {
        node = node.node();
    }
    if (node._ctx) {
        return node._ctx
    }
    if (node.parentNode) {
        return get_context(node.parentNode)
    }

    console.trace();
}

var slice = function(arr, start, end) {
    return Array.prototype.slice.call(arr, start, end);
}

var log = (...args) => console.log(args.map(JSON.stringify).join(' '));
var noop = x => x;
var pack = x => [x];

var query = function(url, callback, post_data) {
    //console.log('QUERY', url);
    var cb = function(error, resp) {
        if (error) {
            alert(error);
        }
        if (callback) {
            callback(resp);
        }
    };
    if (post_data) {
        d3.request(url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(post_data), cb);
    } else {
        d3.json(url, cb);
    }
}


var debounce = function(fun, self) {
    var timer =  null;
    var refresh = function() {
        var args = slice(arguments);
        var timeout = 100;
        if (timer) {
			// Cancel previous invocation
            clearTimeout(timer);
        } else {
            // First invocation, query instantly
            timeout = 0
        }
        // Schedule a new run
        var ev = d3.event
        timer = setTimeout(function() {
            d3.event = ev // Keep track of original event
            fun.apply(self, args);
        }, timeout)
    }
    return refresh;
}

var throttle = function(fun, self) {
    var before = new Date();
    var refresh = function() {
        var now = new Date();
        // Throttle calls
        if (now - before < 200) {
            return;
        }
        // Launch fun
        fun.apply(self, arguments);
        before = new Date();
    };
    return refresh;
}

var popup = function(node, tag) {
    var geo = get_node_geo(node);
    // Add div to body
    var body = d3.select('body');
    var div = one(body, tag);
    div.attr('class', 'card shadowed popup')
    div.style('left', geo.x + 'px')
        .style('top', geo.y + geo.h  + 'px')
    ;

    body.on('keydown', function() {
        var code = d3.event.keyCode;
        if (code == 27) {
            // 27 is esc
            div.remove();
        }
    });

    return div;
}

var typeahead = function(route, select_cb, auto_clear) {
    // Read text
    var target = d3.select(d3.event.target);
    var content = target.text() || target.property('value');
    if (! content || !content.length) {
        return;
    }
    var cb = curry(display_typeahead, target, select_cb, auto_clear === true);
    query(route(content), cb);
}

var display_typeahead = function(el, select_cb, auto_clear, data) {
    var node = el.node();
    var div = popup(node, 'div#typeahead');

    // Add rows
    // var row = div.selectAll('div.row').data(data['values']);
    var [all, enter] = join(div, 'div.row', data['values']);
    enter.attr('class', 'section row');
    all.text(noop);

    // Set active class to first row
    all.classed('active', (d, i) => i == 0);

    var destroy = function() {
        div.remove();
    }

    // blur & focusout event on input
    var delayed_destroy = function() {
        // Delay destroy to let any click on row succeed
        setTimeout(destroy, 200);
    };
    el.on('blur', delayed_destroy);
    el.on('focusout', delayed_destroy);

    var teardown = function(data) {
		var show_value = auto_clear ? '': data
		// Clear input content
		if (node.tagName == 'INPUT') {
			el.property('value', show_value);
		} else {
			el.text(show_value);
		}
        destroy();
        select_cb(data);
    }

    // click event on row
    enter.on('click', function() {
        var txt = d3.select(this).text();
        teardown(txt);
    });
    // Unset kb-set active when using mouse
    enter.on('mouseover', function() {
        div.select('.active').classed('active', false);
        d3.select(this).classed('active', true);
    });
    // keydown on input
    // see http://jsfiddle.net/qAHC2/292/
    el.on('keydown', function() {
        var code = d3.event.keyCode;
        if (code == 13) {
            // 13 is enter
            d3.event.preventDefault();
            teardown(div.select('.active').text());
        }
        else if (code == 38) {
            // 38 is up arrow
            var active = div.select('.active');
            var prev = active.node().previousSibling;
            if (prev === null) {
                return
            }
            div.select('.active').classed('active', false);
            d3.select(prev).classed('active', true);
        }
        else if (code == 40) {
            // 40 is down arrow
            var active = div.select('.active');
            var next = active.node().nextSibling;
            if (next === null) {
                return
            }
            div.select('.active').classed('active', false);
            d3.select(next).classed('active', true);
        }
        return false;
    });

};

var get_node_geo = function (el) {
    var body = d3.select('body').node();
    var height = el.offsetHeight
    var width = el.getBoundingClientRect().width;
    for (var lx = 0, ly = 0;
         el != null && el != body;
         lx += (el.offsetLeft || el.clientLeft), ly += (el.offsetTop || el.clientTop),
         el = (el.offsetParent || el.parentNode));
    return {x: lx, y: ly, h: height, w: width};
}

var indexOf = function(arr, item) {
    return Array.prototype.indexOf.call(arr, item);
}

var curry = function() {
    var curry_args = slice(arguments, 1);
    var curry_fn = arguments[0];
    if (curry_args.length == 0) {
        return curry_fn;
    }
    var _this = this;
    return function() {
        return curry_fn.apply(_this, curry_args.concat(slice(arguments)));
    }
}

var printable = function(data) {
    if (data === null) {
        return '';
    }
    return data;
}


var main = function() {
    var body = d3.select('body')
    root(body);
}


d3.select(document).on('DOMContentLoaded', main);
