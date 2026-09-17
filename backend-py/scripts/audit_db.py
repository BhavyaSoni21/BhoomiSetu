from app.database import engine

with engine.connect() as c:
    print(c.exec_driver_sql("select current_user, current_schema(), has_schema_privilege(current_user, 'public', 'CREATE')").all())
    print(c.exec_driver_sql("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name").all())
