'use strict'


class Table {

    constructor(resp) {
        this.el = d3.select(resp.selector).one('table', resp.table_name);

        // Join dom for THEAD rows
        var head_tr = this.el.one('thead').selectAll('tr')
            .data(resp.columns)
        head_tr.exit().remove();
        head_tr = head_tr.enter()
            .append('tr')
            .merge(head_tr)
        ;

		var th = head_tr.selectAll('th').data(noop)
        th.exit().remove();
        th = th.enter()
            .append('th')
            .merge(th)
        ;
		th.text(d => d.label);
		th.attr('colspan', d => d.colspan);

        // Join dom for TBODY rows
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
        enter_td.merge(td).text(this.deserialize);
    }

    deserialize(data) {
        if (data === null) {
            return '';
        }
        return data;
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

        var route = (content) => '/search/' + table_name + '/' + current_col + '/' + content;
        var td = row.selectAll('td')
            .attr('contenteditable', 'true')
            .on('input', throttle(curry(typeahead, route, noop)))
        ;
    }
}

class Menu {

    constructor(selector) {
        this.el = d3.select(selector);
		this.selected_container = this.el.one('span#selected-container')
			.attr('class', 'input-group fluid');
		this.selector_container = this.el.one('span#selector-container')
			.attr('class', 'input-group fluid');
		this.option_container = this.el.one('span#option-container')
			.attr('class', 'input-group fluid');

		this.selected = [];
		this.refresh();

        var cb = this.push.bind(this);
        this.input.on('input', throttle(curry(typeahead, this.route.bind(this), cb)))
    }

	route(content) {
		if (this.selected.length) {
			var params = 'selected=' + encodeURIComponent(this.selected.join('+'));
			return '/menu/' + content + '?' + params;
		}
		return '/menu/' + content;
	}

	refresh() {
		// Reload main table
		if (this.selected.length) {
			var tables = this.selected.join('+');
			query('/table/' + tables, resp => new Table(resp));
		}
		// Refesh menu dom
		var groups = this.selected_container.selectAll('div.button-group')
			.data(this.selected)
		groups.exit().remove();
		groups = groups.enter().append('div').merge(groups)
			.attr('class', 'button-group')
			.property('index', (d, i) => i)
		;

		var buttons = groups.selectAll('button')
			.data(function(d) {return [d, '✖']})
			.enter()
			.append('button').text(noop)
			.filter((d, i) => i == 1)
			.on('click', this.pop.bind(this))
		;
		buttons.exit().remove()
		
		this.input = this.selector_container.one('input');
		this.input
			.attr('placeholder', 'Add Table')
			.property('value', '');
		this.burger = this.option_container.one('button#burger').text('☰');
	}

	pop() {
        d3.event.preventDefault();
		var group = d3.select(d3.event.target.parentNode);
		var idx = group.property('index');
		this.selected.splice(idx, 1);
		this.refresh();
	}

    push(name) {
		this.selected.push(name);
		this.refresh();
    }

};

// Small utilities
var noop = x => x;
var log = (...args) => console.log(args.map(JSON.stringify).join(' '));

var pluck = function(key) {
    return obj => obj[key];
}

var query = function(url, callback) {
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
    var width = el_node.getBoundingClientRect().width;
    // Add div to body
    var div = d3.select('body').one('div#typeahead');
    div
        .attr('class', 'card shadow-medium')
        .style('width', width + 'px')
    ;

    // Add rows
    var row = div.selectAll('div.row').data(data['values']);
    row.exit().remove();
    row = row.enter()
        .append('div').attr('class', 'section row')
        .merge(row).text(noop)
    ;
    // Set active class to first row
    row.classed('active', (d, i) => i == 0);

    // Launch popper
    Popper.placements = ['bottom-start', 'right', 'left'];
    var popper = new Popper(el_node, div.node(), {
        placement: 'bottom-start',
    });
    var destroy = function() {
        popper.destroy();
        div.remove();
    }

    // blur & focusout event on input
    var delayed_destroy = function() {
        // Delay destroy to let any click on row succeed
        setTimeout(function() {
            if (!popper.state.isDestroyed) {
                destroy();
            }
        }, 100);
    };
    el.on('blur', delayed_destroy);
    el.on('focusout', delayed_destroy);

    var teardown = function(data) {
        // row = d3.select(d3.event.target);
        if (el_node.tagName == 'INPUT') {
            el.property('value', data);
        } else {
            el.text(data);
        }
        destroy();
        select_cb(data);
    }

    // click event on row
    row.on('click', teardown);

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
            var prev = div.select('.active ~ .row');
            div.select('.active').classed('active', false);
            prev.classed('active', true);
        }
        else if (code == 40) {
            // 40 is down arrow
            var next = div.select('.active + .row');
            div.select('.active').classed('active', false);
            next.classed('active', true);
        }
        return false;
    });

};


// Entry point
var main = function(e) {
    new Menu('#menu');
};

d3.select(document).on('DOMContentLoaded', main);
