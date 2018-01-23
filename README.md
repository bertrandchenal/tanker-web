
# Tanker Web

Tanker Web is a web-ui on top of
[tanker](https://bitbucket.org/bertrandchenal/tanker). It's based on
[bottle](https://bottlepy.org/),
[Vega Lite](vega.github.io/vega-lite/) and [D3](https://d3js.org/). D3
is used for all DOM manipulations.

It allows user to display any table managed by tanker, it also allows
to filter and order content.  It also provides basic edition features
like adding or deleting records, auto-completion of fields based on DB
content.

The main design decision was to use tables as only/main way to show
content, it fits better with the tanker philosophy and it's the most
familliar way to edit records (thanks to spreasheet applications).


## Roadmap

- Finish implementation of basic barchart. Add more graphs.
- Implement login and read / write access.
- Add some structure to allows controlers implementation (hooks?
  model classes? routes?).


