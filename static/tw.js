
var main_tpl = {
    // 'data': [null],
    'el': 'table',
    'children' : [
        'thead_tpl'
    ]
};

var thead_tpl = {
    // 'data': [''],
    'el': 'thead>tr>th',
    'children' : [
        'table_header_tpl'
    ]
}

var table_header_tpl = {
    // 'data': [''],
    'el': 'input',
}

var tpl_registry = {
    'main_tpl': main_tpl,
    'thead_tpl': thead_tpl,
    'table_header_tpl': table_header_tpl,
}


var render = function(root, tpl_name, data) {
    // basic assertions
    var tpl = tpl_registry[tpl_name];
    if (!tpl) {
        alert(`Template ${tpl_name} not found`)
    }
    if (!tpl.el) {
        alert('Not element defined');
    }

    // select element to render and join data
    // var els = tpl.el.split('>');
    // var el = root
    // for (var pos in els) {
    //     var tag = els[pos];
    //     el = el.selectAll(tag);
    //     if (pos < els.length - 1) {
    //         el = join(el, tag)
    //     }
    // }
    // var last_tag = els[els.length - 1];
    var el = join(root, tpl.el, data)

    // recurse
    for (var pos in tpl.children || [])  {
        var name = tpl.children[pos];
        render(el, name);
    }
}

var join = function(el, tags, data) {
    tag = tags[0]
    data  = data || [null];
    el = el.data(data);
    el.exit().remove();
    el = el.enter()
        .append(tag)
        .merge(el);
    return el;
}


var slice = function(arr, start, end) {
    return Array.prototype.slice.call(arr, start, end);
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

var main = function() {
    var root = d3.select('body')
    query('/table/plant', function(resp) {
        render(root, 'main_tpl', resp.rows)
    })
}


d3.select(document).on('DOMContentLoaded', main);
