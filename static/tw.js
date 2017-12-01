'use strict'

var table = function(root) {
	// Add table node
	var table_el = one(root, 'table');
	// Display thead content
	thead(table_el);
}

var thead = function(root) {
	// Add nodes
	var menu_el = one(root, 'caption');
	var input = one(menu_el, 'input');
	var thead_el = one(root, 'thead');

	// Define some for query params and response
	var resp = new Observable();
	var params = new Observable();

	// Plug typeahead
	var table_name = new Observable('grid_type');
	var route = (content) => '/menu/' + content;
	input.on('input', debounce(curry(typeahead, route, table_name)))
	input.attr('placeholder', 'Select a table to query');

	// Plug data loading
	new Observable(function() {
		if (!table_name()) {
			return;
		}
		var url = '/table/' + table_name();
		var todo = params();

		// Launch query and assign result to resp
		query(url, resp)
	});

	// Add tbody (triggered if table_name change)
	new Observable(function() {
		if (!resp()) { 
			return;
		}
		// Add headers
		headers(thead_el, resp, params);
		// Add tobdy
		tbody(root, resp);
	});
}

var headers = function(root, resp, params) {
	var columns = resp().columns
	var [all, enter] = join(root, 'tr', columns);
	header_cell(all, noop, params);
}

var header_cell = function(root, data, params) {
	var [all, enter] = join(root, 'th.header', data);
	all.text(d => d.label);
	all.attr('colspan', d => d.colspan);
	all.on('click', curry(header_menu, params));
}

var header_menu = function(params, datum) {
	var node = d3.event.target;
    var geo = get_node_geo(node);

    // Add div to body
    var div = one(d3.select('body'), 'div#header-menu');
    div.attr('class', 'card shadowed popup')
    div.style('width', geo.w + 'px')
        .style('left', geo.x + 'px')
        .style('top', geo.y + geo.h  + 'px')
    ;

	// TODO factorise all behaviour in a pop-up function (that take
	// the id as arg and return the div

	var title = one(div, 'h3');
	title.text('YO MAMA');
}

var tbody = function(root, resp) {
	var rows = resp().rows;
	var tbody = one(root, 'tbody');
	var [all, enter] = join(tbody, 'tr', rows);
	body_cell(all, noop);
}

var body_cell = function(root, row) {
	var [all, enter] = join(root, 'td', row);
	all.text(printable);
}

var one = function(el, tag) {
	var [all, enter] = join(el, tag, [null]);
	return all;
}

var join = function(el, tag, data) {
	// select children
    var select = el.selectAll(tag).data(data);
	// extract id
    var by_id = tag.split('#')
    tag = by_id[0]
    var by_class = tag.split('.')
    tag = by_class[0]

	// Remove old nods and add new
    var exit = select.exit()
	exit.remove();
    var enter = select.enter()
        .append(tag)
	// Set id or class
    if (by_id.length > 1) {
        enter.attr('id', by_id[1]);
    } else if (by_class.length > 1) {
		enter.attr('class', by_class[1])
    }
	// Merge
    var all = enter.merge(select);
    return [all, enter, exit];
}


var slice = function(arr, start, end) {
    return Array.prototype.slice.call(arr, start, end);
}

var log = (...args) => console.log(args.map(JSON.stringify).join(' '));
var noop = x => x;

var query = function(url, callback) {
    var args = slice(arguments, 2);
    d3.json(url, function(error, resp) {
        if (error) {
            alert(error);
        }
        callback(resp, args);
    });
}


var debounce = function(fun, self) {
	var timer =  null;
	var refresh = function() {
		var args = slice(arguments);
		clearTimeout(timer);
		// Schedule a new run
		var ev = d3.event
		timer = setTimeout(function() {
			d3.event = ev // Keep track of original event
			fun.apply(self, args);
		}, 200)
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
    var el_node = el.node();
    var geo = get_node_geo(el_node);
    // Add div to body
    var div = one(d3.select('body'), 'div#typeahead');
    div.attr('class', 'card shadowed popup')
    div.style('width', geo.w + 'px')
        .style('left', geo.x + 'px')
        .style('top', geo.y + geo.h + 'px')
    ;

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
        if (el_node.tagName == 'INPUT') {
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
        else if (code == 27) {
            // 27 is esc
            destroy();
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
    var root = d3.select('body')
    query('/table/plant', function(resp) {
        table(root, resp.rows)
    })
}


d3.select(document).on('DOMContentLoaded', main);
