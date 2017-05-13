'use strict'


var init = function(e) {
    load('/menu', mkmenu)

    d3.selectAll("#menu").on("click", function() {
        var ev = d3.event;
        ev.preventDefault()
        var match = d3.select(ev.target).filter('a')

        if (match.empty()) {
            return
        }
        var href = match.attr('href');
        load(href, mktable);
    }, true)    
};


var mktable = function(resp) {
    var table = d3.select(resp.selector).one('table');

    // Join dom for THEAD
    var th = table.one('thead').one('tr')
        .selectAll('th')
        .data(resp.columns)
    // Remove leaving th
    th.exit().remove();
    // Add entering th new, merge with current and set text
    th.enter()
        .append('th')
        .merge(th).text(String)
    ;

    // Join dom for TBODY
    var tr = table.one('tbody')
        .selectAll('tr')
        .data(resp.rows)
    ;
    // Remove leaving tr
    tr.exit().remove();
    // Add entering tr and lauch a subselect on current+entering tr to
    // add td
    var all_tr = tr.enter().append('tr').merge(tr)
    all_tr.attr('href', function(d, i) {return resp.href[i];});
    var td = all_tr
        .selectAll('td')
        .data(noop)
    ;
    // Remove leaving td
    td.exit().remove();
    td.enter().append('td').merge(td).text(String)
    ;
}


var mkmenu = function(resp) {
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
var noop = function(value) {
    return value;
};

var pluck = function(key) {
    return function (obj) { 
        return obj[key];
    }
}

var load = function(url, callback) {
    d3.json(url, function(error, resp) {
        if (error) {
            alert(error);
        }
        callback(resp);
    });
}

d3.selection.prototype.one = function(tag) {
    // Add one element if it doens't already exists and returns it
    var join = this.selectAll(tag);
    if (join.size() == 1) {
        return join;
    }
    return join.data([null]).enter().append(tag);
};

d3.select(document).on('DOMContentLoaded', init);
