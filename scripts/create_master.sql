CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, biography TEXT, death INTEGER);
CREATE TABLE books (id INTEGER PRIMARY KEY, name TEXT, category INTEGER, type INTEGER, date INTEGER, author INTEGER, printed INTEGER, major INTEGER, minor INTEGER, bibliography TEXT, hint TEXT, pdf_links TEXT, metadata TEXT);
CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);