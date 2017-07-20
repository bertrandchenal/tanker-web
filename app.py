#! /usr/bin/env python3

from  datetime import datetime, date
import json
import sys

from bottle import (
    route, run, template, static_file, install, JSONPlugin, request)
from jinja2 import Environment, FileSystemLoader
from tanker import View, fetch, logger, Table
from tanker import connect, create_tables, yaml_load, ctx, Table

# logger.setLevel('DEBUG')


jinja_env = Environment(loader=FileSystemLoader('static'))
jinja_env.globals.update(zip=zip)
def render(name, *args, **kwargs):
    return jinja_env.get_template(name + '.html').render(*args, **kwargs)


# Define Plugin
class TankerPlugin:

    def __init__(self, cfg):
        self.cfg = cfg

    def apply(self, callback, route):
        def wrap(*args, **kwargs):
            with connect(self.cfg):
                return callback(*args, **kwargs)
        return wrap

# Install plugins
cfg = {
    'db_uri': 'sqlite:///storm.db',
    'schema': open('schema.yaml').read(),
}
install(TankerPlugin(cfg))
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

to_json = lambda x: json.dumps(x, default=json_serial)
install(JSONPlugin(json_dumps=to_json))


@route('/')
def index():
    return static_file('index.html', root='static')

@route('/static/<path:path>')
def callback(path):
    return static_file(path, root='static')

@route('/menu/<prefix>')
def menu(prefix):

    values = [t for t in sorted(ctx.registry) if t.startswith(prefix)]
    return {
        'values': values[:10],
    }


def compress(items):
    prev = first = object()
    cnt = 1
    for it in items:
        if prev == first:
            prev = it
        elif it == prev:
            cnt +=1
        else:
            yield prev, cnt
            prev = it
            cnt = 1
    yield prev, cnt


@route('/table/<tables>')
def table(tables):
    # Create auto view
    tables = tables.split('+')
    tables = map(Table.get, tables)
    main = tables[0]
    fields = []

    # Loop on table and fill fields list
    for table in tables:
        full = True #len(tables) == 1 or not table is main
        if table is main:
            prefix = ''
        else:
            paths = main.link(table)
            if not paths:
                continue
            # TODO choose path based on other tables
            prefix = '.'.join(col.name for col in paths[0])

        if prefix:
            prefix += '.'
        add_fields = lambda *xs: fields.extend(prefix + x for x in xs \
                                           if prefix + x not in fields)
        for col in table.own_columns:
            if col.ctype ==  'M2O':
                if not full:
                    # Skip relation in multi-table query
                    continue
                ft = col.get_foreign_table()
                add_fields(*('.'.join((col.name, i)) for i in ft.index))
            else:
                add_fields(col.name)

    # Generate output
    view = View(main.name, fields)
    field_cols = []
    for field in view.fields:
        if field.ref:
            table = field.ref.remote_table.name
        else:
            table = main.name
        field_cols.append({
            'label': field.col.name, # XXX better label
            'name': field.name,
            'table': table,
            'colspan': 1,
        })

    fltr = []
    params = dict(request.params)
    names = set(f.name for f in view.fields)
    for k, v in params.items():
        if k not in names:
            continue
        # TODO sanitize, use {}
        fltr.append('(ilike %s "%s%%")' % (k, v))

    rows = list(view.read(fltr, limit=1000))
    return {
        'columns': [field_cols],
        'rows': rows,
        'selector': '#main',
        'table_name': main.name,
    }

@route('/search/<col>/<prefix:path>')
def search(col, prefix):
    # TODO sanitize col
    table, col = col.split('.', 1)
    fltr = '(like %s {prefix})' % col
    rows = View(table, [col]).read(
        fltr, limit=10, groupby=col,
        args={'prefix': prefix + '%',})
    values = [x for x, in rows]
    return {
        'values': values
    }


def main():
    action = sys.argv[1]
    if action == 'run':
        run(host='localhost', port=8080) #, server='cherrypy'
    elif action == 'init':
        with connect(cfg):
            create_tables()


if __name__ == '__main__':
    main()
