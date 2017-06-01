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
		window.td=td;

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

var indexOf = function(arr, item) {
	return Array.prototype.indexOf.call(arr, item);
}

var slice = function(arr, start, end) {
	return Array.prototype.slice.call(arr, start, end);
}

var log = console.log

d3.selection.prototype.one = function(tag, data) {
    // Add one element if it doens't already exists and returns it
    var join = this.selectAll(tag);
    if (join.size() == 1) {
        return join;
    }
    return join.data([data]).enter().append(tag);
};


var throttle = function(fun) {
	var before = new Date();
	var refresh = function() {
		var now = new Date();
		// Throttle calls
		if (now - before < 300) {
			return;
		}

		// Launch fun
		fun.bind(this)(arguments);
		before = new Date();
	};
	return refresh;
}

var typeahead = function(route, el) {
	// Read text
	var content = el.text();
	if (!content.length) {
		return;
	}
	var cb = display_typeahead.bind(this);
	load(route + content, cb);
}

var display_typeahead = function(data) {
	var table = d3.select('#main table');
	var tr = table.select('thead tr');
};


// Entry point
var main = function(e) {
    load('/menu', resp => new Menu(resp))

    d3.selectAll("#menu").on("click", function() {
        var ev = d3.event;
        ev.preventDefault()
        var match = d3.select(ev.target).filter('a')

        if (match.empty()) {
            return
        }
        var href = match.attr('href');
        load(href, resp => new  Table(resp));
    }, true)
};

d3.select(document).on('DOMContentLoaded', main);
