from  datetime import datetime, date
import json
import sys

from bottle import route, run, template, static_file, install, JSONPlugin
from jinja2 import Environment, FileSystemLoader
from tanker import View, fetch, logger, Table
from tanker import connect, create_tables, yaml_load, ctx, Table

logger.setLevel('DEBUG')


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

@route('/table/<table_name>')
def table(table_name):
    # Create auto view
    table = Table.get(table_name)
    fields = []
    for col in table.own_columns:
        if col.ctype ==  'M2O':
            idx = col.get_foreign_table().index
            foreign_fields = ['%s.%s' % (col.name, i) for i in idx]
            fields.extend(foreign_fields)
        else:
            fields.append(col.name)

    view = View(table_name, fields)
    rows = list(view.read(limit=1000))
    return {
        # 'labels': [f.name for f in view.fields],
        'columns': [f.name for f in view.fields],
        'rows': rows,
        'selector': '#main',
        'table_name': table_name,
        # 'href': href,
        # 'menu': menu,
    }

@route('/search/<table>/<col>/<prefix>')
def search(table, col, prefix):
    # TODO sanitize col
    fltr = '(like %s {prefix})' % col
    rows = View(table, [col]).read(
        fltr, limit=10, groupby=[col],
        args={'prefix': prefix + '%',})
    values = [x for x, in rows]
    print(values)
    return {
        'values': values
    }


def main():
    action = sys.argv[1]
    if action == 'run':
        run(host='localhost', port=8080, reloader=True)
    elif action == 'init':
        with connect(cfg):
            create_tables()


if __name__ == '__main__':
    main()
