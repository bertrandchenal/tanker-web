'use strict'


class Table {

	constructor(resp) {
		this.el = d3.select(resp.selector).one('table', resp.table_name);

		// Join dom for THEAD
		var th = this.el.one('thead').one('tr')
			.selectAll('th')
			.data(resp.columns)
		// Remove extra th
		th.exit().remove();
		// Add entering th new, merge with current and set text
		th.enter()
			.append('th')
			.merge(th).text(String)
		;

		// Join dom for TBODY
		var tr = this.el.one('tbody')
			.selectAll('tr')
			.data(resp.rows)
		;
		// Remove leaving tr
		tr.exit().remove();

		// merge entering tr to current ones
		var all_tr = tr.enter().append('tr').merge(tr)

		// Bind edit
		all_tr.on('click', this.edit.bind(this));

		// Lauch a subselect on tr to add td children
		var td = all_tr.selectAll('td').data(noop);
		// Remove leaving td
		td.exit().remove();
		var enter_td = td.enter().append('td')
		enter_td.merge(td).text(String);
	}

	edit() {
		var td = d3.event.target;
		var tr = td.parentNode;

		// Update active line
		var old_active = d3.select('.active');
		old_active.attr('class', '');
		var row = d3.select(tr);
		row.attr('class', 'active')

		// Enable typeahead
		var table_name = this.el.data();
		var th = this.el.selectAll('th');
		var idx = indexOf(tr.children, td);
		var columns = th.data();
		var current_col = columns[idx];

		var route = '/search/' + table_name + '/' + current_col + '/';
		var td = row.selectAll('td')
			.attr('contenteditable', 'true')
			.on('input', throttle(curry(typeahead, route)))
		;
	}
}

var Menu = function(resp) {
    var get_url = pluck(resp.columns.indexOf('Url'));
    var get_title = pluck(resp.columns.indexOf('Title'));
    var ul = d3.select(resp.selector)
    ul.append('div')
        .attr('class', 'section')
        .append('h4')
        .text('Menu')
    ;
    ul.selectAll('div.section.row')
        .data(resp.rows).enter()
        .append('div')
        .attr('class', 'section row')
        .append('a')
        .attr('href', get_url)
        .text(get_title);
}


// Small utilities
var noop = x => x;
var log = (...args) => console.log(args.map(JSON.stringify).join(' '));

var pluck = function(key) {
    return obj => obj[key];
}

var load = function(url, callback) {
	var args = slice(arguments, 2);
    d3.json(url, function(error, resp) {
        if (error) {
            alert(error);
        }
        callback(resp, args);
    });
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


var indexOf = function(arr, item) {
	return Array.prototype.indexOf.call(arr, item);
}

var slice = function(arr, start, end) {
	return Array.prototype.slice.call(arr, start, end);
}


d3.selection.prototype.one = function(tag, data) {
    // Add one element if it doens't already exists and returns it
    var join = this.selectAll(tag);
    if (join.size() == 1) {
        return join.data([data]);
    }
	// This allows to use a tag like 'div#id'
	var splitted = tag.split('#')
	var tagel = splitted[0]
    var el = join.data([data]).enter().append(tagel);
	if (splitted.length > 1) {
		el.attr('id', splitted[1]);
	}
	return el;
};

var throttle = function(fun) {
	var before = new Date();
	var refresh = function() {
		var now = new Date();
		// Throttle calls
		if (now - before < 200) {
			return;
		}

		// Launch fun
		fun.bind(this)(arguments);
		before = new Date();
	};
	return refresh;
}

var typeahead = function(route) {
	// Read text
	var target = d3.select(d3.event.target);
	var content = target.text();
	if (!content.length) {
		return;
	}
	var cb = curry(display_typeahead, target);
	load(route + content, cb);
}

var display_typeahead = function(input, data) {
    var input_node = input.node();
    var width = input_node.getBoundingClientRect().width;

    // Add div to body
	// var div = d3.select('body').one('div#typeahead-arrow');
	var div = d3.select('body').one('div#typeahead');
	div
        .attr('class', 'card shadow-medium')
        .style('width', width + 'px')
    ;

	var row = div.selectAll('div.row').data(data['values']);
	row.exit().remove();
	row = row.enter()
        .append('div').attr('class', 'section row')
        .merge(row).text(noop)
    ;

    // Launch popper
    Popper.placements = ['bottom-start', 'right', 'left'];
	var popper = new Popper(input_node, div.node(), {
		placement: 'bottom-start',
	});

    // blur event on input
	input.on('blur', function() {
        // Delay destroy to let any click on row succeed
		setTimeout(function() {
            popper.destroy();
        }, 100);
	});

    // click event on row
    row.on('click', function() {
        var row = d3.select(d3.event.target);
        var text = row.data();
        input.text(text);
		popper.destroy();
    });


    // keydown on input
    // see http://jsfiddle.net/qAHC2/292/
    input.on('keydown', function() {
        var code = d3.event.keyCode;
        if (code == 13) {
            // 13 is enter
        }
        else if (code == 27) {
            // 27 is esc
            popper.destroy();
        }
        else if (code == 38) {
            // 38 is up arrow
        }
        else if (code == 40) {
            // 40 is down arrow
        }
    });

};


// Entry point
var main = function(e) {
    load('/menu', resp => new Menu(resp))

    d3.selectAll('#menu').on('click', function() {
        var ev = d3.event;
        ev.preventDefault()
        var match = d3.select(ev.target).filter('a')

        if (match.empty()) {
            return
        }
        var href = match.attr('href');
        load(href, resp => new Table(resp));
    }, true)
};

d3.select(document).on('DOMContentLoaded', main);
