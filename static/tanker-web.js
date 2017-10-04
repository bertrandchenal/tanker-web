'use strict'

const burger_icon = '\u2630';
const cross_icon = '\u2716';

class Table {

    constructor(resp, menu) {
		this.menu = menu;
        this.el = d3.select(resp.selector).one('table', resp.table_name);
		// this.el.attr('class', 'scrollable');

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
		th.attr('colspan', d => d.colspan);

		var span = th.selectAll('span').data(d => [d.label, burger_icon])
        span.exit().remove();
		span = span.enter().append('span').merge(span);
		span.text(noop);
		span.attr('class', (d, i) => i == 0 ? 'header': 'header-icon')
		span.on('click', this.header_menu.bind(this));


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
        all_tr.on('focusin', this.edit.bind(this));

        // Lauch a subselect on tr to add td children
        var td = all_tr.selectAll('td').data(noop);
        // Remove leaving td
        td.exit().remove();
        var enter_td = td.enter().append('td')
        enter_td.merge(td).text(this.deserialize);
    }

	save() {
		var rows = d3.selectAll('.edited');
		var dataset = [];
		rows.each(function() {
			var el = d3.select(this);
			var items = el.selectAll('td')
			var row_values = []
			items.each(function() {
				row_values.push(d3.select(this).text())
			})
			dataset.push(row_values);
		});
		rows.classed('edited', false);
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

        // Update active line and flag as potentially edited
        var old_active = d3.select('.active');
        old_active.classed('active', false);
        var row = d3.select(tr);
        row.attr('class', 'active edited')


        // Enable typeahead
        var table_name = this.el.data();
		var th = this.el.selectAll('thead tr:nth-last-child(1) th')
        var idx = indexOf(tr.children, td);
        var columns = th.data();
        var column = columns[idx];
        var td = row.selectAll('td')
            .attr('contenteditable', 'true')

		if (column.name.indexOf('.') < 0) {
			return;
		}
		// Enable typeahead on fk
		var route = (content) => `/search/${table_name}/${column.name}/`
			+ encodeURIComponent(content);
		td.on('input', throttle(curry(typeahead, route, noop)));
    }

	header_menu() {
		// Reveal popup
		d3.select('#modal-option-toggle').node().click();

		// Find which column was clicked
        var span = d3.event.target;
        var th = span.parentNode;
		var column_info = d3.select(th).data()[0];

		// Create header menu object
		var el = d3.select('#modal-body');
		var hm = new HeaderMenu(el, column_info, this);
	}
}


class HeaderMenu {

	constructor(el, info, table) {
		this.content = el.select('.modal-content');
		this.footer = el.select('.modal-footer');
		this.info = info;
		this.table = table
		this.refresh();

		// Set title
		el.one('h3.title').text(info.label);

		// Add button
		var button_data = [{
			'label': 'Ok',
			'class': 'button primary',
			'action': this.save.bind(this),
		}];
		var buttons = this.footer.selectAll('label').data(button_data);
		buttons.exit().remove();
		buttons.enter().append('label')
			.text(d => d.label)
			.attr('class', (d) => d.class)
			.attr('for', 'modal-option-toggle')
			.on('click', (d, i) => d.action ? d.action(): null)
		;
	}

	save() {
		var tags = ['input', 'select']
		var main_menu = this.table.menu;
		var name = this.info.name;
		for (var pos in tags) {
			var els = this.content.selectAll(tags[pos]);
			els.each(function() {
				var el = d3.select(this);
				var value = el.property('value');
				var type = el.attr('id')
				if (type == 'filter') {
					main_menu.filters[name] = value;
				}
			})
		}
		main_menu.refresh_table();
	}

	refresh() {
		var main_menu = this.table.menu;
		var form = this.content.one('form');
		var fields = [
			{
				'label': 'Filter',
				'id': 'filter',
				'type': 'text',
				'value': main_menu.filters[this.info.name] || '',
			},
			{
				'label': 'Sort',
				'id': 'sort',
				'type': 'select',
				'choice': [['', ''], ['asc', 'Ascending'] , ['desc', 'Descending']],
			},
		];
		var group = form.selectAll('div.input-group').data(fields);
		group.exit().remove();
		group = group.enter()
			.append('div')
			.attr('class', 'input-group vertical')
			.merge(group)
		;

		var self = this;
		group.each(function(d, i) {
			var el = d3.select(this);
			self.option_field.apply(self, [el, d, i]);
		})
	}

	option_field(el, field, pos) {
		// var el = d3.select(this);
		el.one('label')
			.text(field.label)
			.attr('for', field.id);
		if (field.type == 'text') {
			el.one('input')
				.attr('id', field.id)
				.attr('placeholder', field.label)
				.property('value', field.value)
			;
            el.on('keydown', function() {
                var code = d3.event.keyCode;
                if (code == 13) {
                    // 13 is enter
		            this.save()
		            d3.select('#modal-option-toggle').node().click();
                }
            }.bind(this))

		} else if (field.type == 'select') {
			var select = el.one('select')
				.attr('id', field.id)
				.attr('disabled', '') // Sorting not yet supported
			;
			var option = select.selectAll('option').data(field.choice)
			option.exit().remove();
			option = option.enter()
				.append('option')
				.merge(option)
				.attr('value', d => d[0])
				.text(d => d[1]);
		}
	}
}


class Menu {

    constructor(selector) {
        this.el = d3.select(selector);
		this.selector_container = this.el.one('div#selector-container')
			.attr('class', 'section')
		;
		this.selection_container = this.el.one('div#selected-container')
			.attr('class', 'secion')
		;
		var hash = window.location.hash;
		this.selection = hash.length ? hash.slice(1).split('+') : [];
		this.selected = this.selection[0];
		this.filters = {};
		this.refresh();

        var cb = this.push.bind(this);
        this.input.on('input', throttle(curry(typeahead, this.route.bind(this), cb)))

    }

	route(content) {
		if (this.selection.length) {
			var params = 'selection=' + encodeURIComponent(this.selection.join('+'));
			return '/menu/' + content + '?' + params;
		}
		return '/menu/' + content;
	}

	refresh() {
		this.filters = {};
		this.refresh_table();

		// Refesh menu dom
		var groups = this.selection_container.selectAll('div.button-group')
			.data(this.selection)
		groups.exit().remove();
		groups = groups.enter().append('div').merge(groups)
			.attr('class', 'button-group')
		;

		var buttons = groups.selectAll('button')
			.data((d, i) => [
				{'text': d, 'idx': i, 'action': 'select'},
				{'text': cross_icon, 'idx': i, 'action': 'pop'},
			]);

		var self = this;
		buttons.enter()
			.append('button')
			.merge(buttons)
			.text((d) => d.text)
			.on('click', function(d) {
				self[d.action].apply(self, [d.text])
			})
		;

		this.input = this.selector_container.one('input');
		this.input
			.attr('placeholder', 'Show Table')
			.property('value', '');
	}

	refresh_table() {
		var hash = window.location.hash;
		var tables = this.selection.join('+');
		if (tables != hash) {
			window.location.hash = tables;
		}
		if (this.selected) {
			var params = Object.entries(this.filters).map(
				([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
			if (params.length) {
				params = '?' + params.join('&');
			}
			query(
				'/table/' + this.selected + params,
				function(resp) {
					this.table = new Table(resp, this);
				}.bind(this));
		}
	}

	select(datum) {
		this.selected = datum;
		this.refresh()
	}

	pop(datum) {
		var spliced = this.selection.splice(datum.idx, 1);
		if (spliced[0] == this.selected) {
			this.selected = this.selection[0]? this.selection.length: null;
		}
		this.refresh();
	}

    push(name) {
		this.selection.push(name);
		this.selected = name;
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

var get_node_geo = function (el) {
    var body = d3.select('body').node();
    var height = el.offsetHeight
    for (var lx = 0, ly = 0;
         el != null && el != body;
         lx += (el.offsetLeft || el.clientLeft), ly += (el.offsetTop || el.clientTop),
         el = (el.offsetParent || el.parentNode));
    return {x: lx, y: ly, h: height};
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
    var el_geo = get_node_geo(el_node);
    var width = el_node.getBoundingClientRect().width;
    // Add div to body
    var div = d3.select('body').one('div#typeahead');
    div.attr('class', 'card shadowed')
    div.style('width', width + 'px')
        .style('left', el_geo.x + 'px')
        .style('top', el_geo.y + +el_geo.h + 'px')
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
    row.on('click', function() {
		var txt = d3.select(this).text();
		teardown(txt);
	});
    // Unset kb-set active when using mouse
    row.on('mouseover', function() {
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


// Entry point
var main = function(e) {
    new Menu('#menu');
};

d3.select(document).on('DOMContentLoaded', main);
