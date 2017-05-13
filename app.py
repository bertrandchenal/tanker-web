import sys
from bottle import route, run, template, static_file, install
from tanker import connect, create_tables, yaml_load
from tanker import View, fetch
from jinja2 import Environment, FileSystemLoader


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

# Install plugin
cfg = {
    'db_uri': 'sqlite:///storm.db',
    'schema': open('schema.yaml').read(),
}
install(TankerPlugin(cfg))

MENU = yaml_load(open('menu.yaml').read())

@route('/')
def index():
    return static_file('index.html', root='static')

@route('/static/<path:path>')
def callback(path):
    return static_file(path, root='static')

@route('/menu')
def contact():
    rows = []
    for key, values in MENU.items():
        rows.append([values['title'], '/table/%s' % key])
    return {
        'columns': ['Title', 'Url'],
        'rows': rows,
        'selector': '#menu',
    }

@route('/edit/<menu>/<record>')
def edit(menu, record):
    details = MENU[menu]
    table = details['table']
    fields = details['fields']
    row = View(table, fields).read({'id': record}).next()
    return render('edit', row=row, fields=fields, record=record, menu=menu)

@route('/table/<menu>')
def table(menu):
    details = MENU[menu]
    table = details['table']
    fields = [('id', 'id')]
    fields.extend(details['fields'].items())
    print(fields)
    data = list(View(table, fields).read())
    href = ['/edit/%s' % d[0] for d in data]
    rows = [d[1:] for d in data]
    return {
        'columns': list(details['fields'].keys()),
        'rows': rows,
        'selector': '#main',
        'href': href,
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
