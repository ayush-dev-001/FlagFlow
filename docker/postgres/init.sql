-- Runs once, when the postgres volume is first created. Unit/integration tests and the e2e suite each get
-- their own database, so running both at once can never truncate each other's data.
CREATE DATABASE flagflow_test OWNER flagflow;
CREATE DATABASE flagflow_e2e OWNER flagflow;
