GRANT ALL PRIVILEGES ON *.* TO 'app'@'%';
CREATE TABLE users (id INT, password VARCHAR(50));
DELETE FROM users;
UPDATE users SET role = 'admin';
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
CREATE POLICY open ON profiles USING (true);
SELECT * FROM orders WHERE name LIKE '%abc';
CREATE USER app IDENTIFIED BY 'hunter2';
