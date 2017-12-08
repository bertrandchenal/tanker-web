#! /usr/bin/env python3

from  datetime import datetime, date
import json
import argparse
import shlex

from bottle import (
    route, run, static_file, install, JSONPlugin, request)
from tanker import View, connect, create_tables, ctx, Table, ReferenceSet

# from tanker import logger
# logger.setLevel('DEBUG')


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
     #postgresql://storm:3mv@10.22.160.244/storm-bch
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
    print prefix, values
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

@route('/write/<tables>', method='POST')
def write(tables):
    data = request.json
    main, fields = view_helper(tables)
    view = View(main.name, fields)
    view.write(data)

def view_helper(tables):
    # Create auto view
    tables = tables.split('+')
    tables = list(map(Table.get, tables))
    main = tables[0]
    fields = []
    simple_table = len(tables) == 1

    # Loop on table and fill fields list
    for table in tables:
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
                if not simple_table:
                    # Skip relation in multi-table query
                    continue
                ft = col.get_foreign_table()
                add_fields(*('.'.join((col.name, i)) for i in ft.index))
            else:
                add_fields(col.name)
    return main, fields

@route('/read/<tables>')
def read(tables):
    main, fields = view_helper(tables)
    simple_table = True # TODO keep multi-table queries ?
    # Generate output
    view = View(main.name, fields)
    field_cols = []
    for field in view.fields:
        if field.ref:
            table = field.ref.remote_table.name
            label = field.col.name if simple_table else field.ref.remote_field
        else:
            table = main.name
            label= field.col.name
        field_cols.append({
            'label': label,
            'name': field.name,
            'table': table,
            'colspan': 1,
        })
    operators = ['>=', '<=', '=', '>', '<', '!=', 'like', 'ilike', 'in',
                 'notin']

    fltr = []
    args = []
    params = dict(request.params)
    names = set(f.name for f in view.fields)
    sort = None
    if ':sort' in params:
        sort = params.pop(':sort')
        sort = tuple(sort.split(':'))

    for k, v in params.items():
        if k not in names:
            continue
        if not v.strip():
            continue
        # TODO add special case if first char is '('
        for op in operators:
            if v.startswith(op):
                fltr.append('(%s %s {})' % (op, k))
                v = shlex.split(v[len(op):])
                args.append(v)
                break
        else:
            fltr.append('(ilike %s {})' % k)
            args.append(v + '%')

    rows = list(view.read(fltr, args=args, limit=1000, order=sort))
    return {
        'columns': [field_cols],
        'rows': rows,
        'table_name': main.name,
    }

@route('/search/<table>/<field>/<prefix:path>')
def search(table, field, prefix):
    ref = ReferenceSet(Table.get(table)).get_ref(field)
    remote_col = ref.remote_table.get_column(ref.remote_field).name

    fltr = '(like %s {prefix})' % remote_col
    rows = View(ref.remote_table.name, [remote_col]).read(
        fltr, limit=10, groupby=remote_col,
        args={'prefix': prefix + '%',})
    values = [x for x, in rows]
    return {
        'values': values
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', help='run | init')
    parser.add_argument('--server', '-s', help='Wsgi server to use',
                        default='cherrypy')
    parser.add_argument('--debug', '-d', action='store_true',
                        help='Enable debug mode')
    cli = parser.parse_args()

    if cli.action == 'run':
        run(host='localhost', port=8080, server=cli.server, debug=cli.debug)
    elif cli.action == 'init':
        with connect(cfg):
            create_tables()


if __name__ == '__main__':
    main()
