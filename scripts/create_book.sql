CREATE TABLE page (id INTEGER PRIMARY KEY, content TEXT, part INTEGER, page INTEGER, number INTEGER);
CREATE TABLE title (id INTEGER PRIMARY KEY, content TEXT, page INTEGER, parent INTEGER)