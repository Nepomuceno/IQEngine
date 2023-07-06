from importer.datasource import import_datasources_from_env
from importer.plugins import import_plugins_from_env


def import_all_from_env():
    import_plugins_from_env()
    import_datasources_from_env()
