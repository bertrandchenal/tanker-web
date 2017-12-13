'use strict'

var root = function(body) {
    var container = one(body, 'div.container');
    var menu_row = one(container, 'div#menu-row.row');
    var content_row = one(container, 'div#content-row.row');

    // Add context of observables
    var ctx = {
        'resp': new Observable(),
        'table_name': new Observable(),
        'filters': new Observable({}),
        'sort': new Observable(),
        'edited': new Observable(false),
        'mode': new Observable('table'),
    }
    set_context(container, ctx);
    menu(menu_row);

    // Show table or graph based on mode
    table(content_row);
    graph(content_row);

    // Add content add refresh it when mode change
    refresh_content();
    ctx.mode.subscribe(refresh_content);
}

var table = function(content_row) {
    var ctx = get_context(content_row);
    // Add table node
    var col = one(content_row, 'div#table-col.col-sm-12')
    new Observable(function() {
        var val = ctx.mode();
        col.style('display', val == 'table' ? '' : 'none');
    });

    var table_el = one(col, 'table');
    // Add thead & table rows
    thead(table_el);
    // Add table buttons
    table_menu(table_el)
    // Auto-load first table
    ctx.table_name('zone');
}

var graph = function(content_row) {
    var ctx = get_context(content_row);
    // Add vis div
    var div = one(content_row, 'div#vis');
    // Remove it if mode is changed
    new Observable(function() {
        var val = ctx.mode();
        div.style('display', val == 'graph' ? '' : 'none')
    });

    var spec = {
        'data': {
            "values": [
                {"a": "A","b": 28}, {"a": "B","b": 55}, {"a": "C","b": 43},
                {"a": "D","b": 91}, {"a": "E","b": 81}, {"a": "F","b": 53},
                {"a": "G","b": 19}, {"a": "H","b": 87}, {"a": "I","b": 52}
            ]
        },
        'mark': 'bar',
        'encoding': {
            'x': {
                'field': 'a',
                'type': 'ordinal'
            },
            'y': {
                'field': 'b',
                'type': 'quantitative'
            }
        }
    }
    var opt = {
        mode: 'vega-lite',
        actions: {export: true, source: false, editor: false}
    };
    vegaEmbed('#vis', spec, opt);
}


var menu = function(menu_row) {
    var ctx = get_context(menu_row);
    var left_col = one(menu_row, 'div.col-sm-4.input-group.fluid.col-sm-offset-4');
    // var right_col = one(menu_row, 'div.col-sm-3.input-group');

    // Add main input
    var input = one(left_col, 'input.col-sm');
    // Plug typeahead
    var route = (content) => '/menu/' + content;
    input.on('input', debounce(curry(typeahead, route, ctx.table_name)))
    input.attr('placeholder', 'Select a table to query');

    // Add buttons
    var btn_group = one(left_col, 'div.button-group');

    var save_btn = one(btn_group, 'button');
    new Observable(function() {
        var label = ctx.mode() == 'table' ? 'Graph': 'Table';
        save_btn.text(label);
    });
    save_btn.on('click', () => ctx.mode(ctx.mode() == 'table' ? 'graph': 'table'))
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
    all.text(d => d.label);
    all.attr('colspan', d => d.colspan);
    all.on('click', curry(header_menu));
}

var header_menu = function(datum, idx) {
    var node = d3.event.target;
    var div = popup(node, 'div#header-menu');
    var ctx = get_context(node);
    var filters = ctx.filters();
    var resp = ctx.resp();
    var child_cols = resp.columns[resp.columns.length - 1];
    var column = child_cols[idx];

    // Add sections to card
    var title_row = one(div, 'div#popup-title')
    title_row.attr('class', 'section row');
    var body_row = one(div, 'form#popup-body')
    body_row.attr('class', 'section row');
    var footer_row = one(div, 'div#popup-footer')
    footer_row.attr('class', 'section row');

    // Fill title section
    var title = one(title_row, 'h3');
    title.text(datum.label);

    // Fill body section
    var filter_group = one(body_row, 'div#filter');
    filter_group.attr('class', 'input-group vertical')
    var filter_label = one(filter_group, 'label');
    filter_label.text('Filter');
    filter_label.attr('for', 'column-filter');
    var filter_input = one(filter_group, 'input');
    filter_input.attr('placeholder', 'Filter');
    filter_input.attr('id', 'column-filter');
    filter_input.property('value', filters[column.name] || '');

    var sort_group = one(body_row, 'div#sort');
    sort_group.attr('class', 'input-group vertical')
    var sort_label = one(sort_group, 'label');
    sort_label.text('Sort');
    var sort_btn_group = one(sort_group, 'div#sort-btn');
    sort_btn_group.attr('class', 'button-group')

    var sort_btn_type = ['Ascending', 'Descending'];
    var [sort_btn_all] = join(sort_btn_group, 'button', sort_btn_type);
    sort_btn_all.text(noop);
    sort_btn_all.attr('id', (d) => 'btn-' + d.toLowerCase());


    // Fill footer section
    var ok_btn = one(footer_row, 'button#ok');
    ok_btn.text('Ok').attr('class', 'button primary');
    var cancel_btn = one(footer_row, 'button#cancel');
    cancel_btn.text('Cancel').attr('class', 'button');

    // Plug events
    sort_btn_all.on('click', function(d) {
        d3.event.preventDefault();
        ctx.sort(column.name + (d == 'Ascending' ? ':asc' : ':desc'))
    });
    var ok_fun = function() {
        // Update context
        var value = filter_input.property('value')
        // Update filter dict & trigger refresh
        filters[column.name] = value;
        ctx.filters.trigger();
        div.remove();
    };
    ok_btn.on('click', ok_fun)
    filter_input.on('keydown', function() {
        var code = d3.event.keyCode;
        if (code == 13) {
            // 13 is enter
            d3.event.preventDefault();
            ok_fun();
        }
    });
    cancel_btn.on('click', function() {
        div.remove();
    });
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
    tr.selectAll('td').attr('contenteditable', 'true')
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
    var div = one(body, 'div#table_menu');
    div.attr('class', 'card shadowed popup')
    // Hide div if mode change
    new Observable(function() {
        var val = ctx.mode();
        div.style('display', val == 'table' ? '' : 'none')
    });

    // Plug scrolling refresh
    var refresh_div = function() {
        var geo = get_node_geo(root.node());
        var scroll_top = document.documentElement.scrollTop;
        var viewport_bottom = scroll_top + window.innerHeight - 100;
        var table_bottom = geo.y + geo.h + 10;
        var bottom = Math.min(table_bottom, viewport_bottom);
        div.transition()
            .style('width', geo.w + 'px')
            .style('left', geo.x + 'px')
            .style('top', bottom + 'px');
    }
    // Plug events
    ctx.resp.once(() => setTimeout(refresh_div, 500));
    d3.select(window).on('scroll', debounce(refresh_div))

    // Add Save button
    var btn_group = one(div, 'div.button-group');
    btn_group.classed('col-sm-4', true);
    var save_btn = one(btn_group, 'button');
    save_btn.text('save');
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

}

var one = function(el, tag) {
    var [all, enter] = join(el, tag, [null]);
    return all;
}

var join = function(el, tag, data) {
    // select children
    var select = el.selectAll(tag).data(data);
    // extract classes
    var by_class = tag.split('.')
    tag = by_class[0]
    // extract id
    var by_id = tag.split('#')
    tag = by_id[0]

    // Remove old nodes and add new
    var exit = select.exit()
    exit.remove();
    var enter = select.enter()
        .append(tag)
    // Set id or class
    if (by_id.length > 1) {
        enter.attr('id', by_id[1]);
    }
    // Add classes
    enter.attr('class', by_class.slice(1).join(' '))

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
    div.style('width', geo.w + 'px')
        .style('left', geo.x + 'px')
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

var typeahead = function(route, select_cb) {
    // Read text
    var target = d3.select(d3.event.target);
    var content = target.text() || target.property('value');
    if (! content || !content.length) {
        return;
    }
    var cb = curry(display_typeahead, target, select_cb);
    query(route(content), cb);
}

var display_typeahead = function(el, select_cb, data) {
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
        if (node.tagName == 'INPUT') {
            el.property('value', data);
        } else {
            el.text(data);
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
    for (var lx = 0, ly = 0;
         el != null && el != body;
         lx += (el.offsetLeft || el.clientLeft), ly += (el.offsetTop || el.clientTop),
         el = (el.offsetParent || el.parentNode));
    var width = el.getBoundingClientRect().width;
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
